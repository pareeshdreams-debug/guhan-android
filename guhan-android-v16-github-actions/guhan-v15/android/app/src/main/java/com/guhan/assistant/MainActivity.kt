package com.guhan.assistant

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.os.BatteryManager
import android.util.DisplayMetrics
import android.net.Uri
import android.os.Bundle
import android.provider.AlarmClock
import android.provider.CalendarContract
import android.provider.Settings
import android.speech.RecognizerIntent
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import java.util.Locale

class MainActivity : Activity() {
    private lateinit var web: WebView
    private var assistantInvocation = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        assistantInvocation = isAssistantInvocation(intent)
        setupWebView()
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent != null && isAssistantInvocation(intent)) {
            assistantInvocation = true
            if (::web.isInitialized) web.evaluateJavascript("window.guhanAssistantInvoked && window.guhanAssistantInvoked()", null)
        }
    }

    private fun isAssistantInvocation(intent: Intent?): Boolean {
        if (intent == null) return false
        return intent.action == Intent.ACTION_ASSIST || intent.getBooleanExtra("GUHAN_ASSISTANT_INVOCATION", false)
    }

    private fun setupWebView() {
        web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = true
            webChromeClient = WebChromeClient()
            webViewClient = WebViewClient()
            addJavascriptInterface(GuhanBridge(), "GuhanAndroid")
            loadUrl("file:///android_asset/index.html")
        }
        setContentView(web)
    }

    inner class GuhanBridge {
        @JavascriptInterface fun openApp(packageName: String) = launchPackage(packageName)

        @JavascriptInterface fun openAppByName(appName: String) {
            runOnUiThread {
                val wanted = appName.trim().lowercase(Locale.getDefault())
                try {
                    val intent = packageManager.queryIntentActivities(
                        Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER),
                        PackageManager.MATCH_ALL
                    ).firstOrNull { info ->
                        val label = info.loadLabel(packageManager).toString().lowercase(Locale.getDefault())
                        label == wanted || label.contains(wanted) || wanted.contains(label)
                    }?.let { info ->
                        Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER).apply {
                            setPackage(info.activityInfo.packageName)
                            component = info.activityInfo.componentName
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                    }
                    if (intent != null) startActivity(intent)
                    else Toast.makeText(this@MainActivity, "I couldn't find $appName", Toast.LENGTH_SHORT).show()
                } catch (_: Exception) {
                    Toast.makeText(this@MainActivity, "Couldn't open $appName", Toast.LENGTH_SHORT).show()
                }
            }
        }

        @JavascriptInterface fun mapSearch(query: String) {
            runOnUiThread {
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=${Uri.encode(query)}")))
                } catch (_: Exception) {
                    openWeb("https://www.google.com/maps/search/?api=1&query=${Uri.encode(query)}")
                }
            }
        }

        @JavascriptInterface fun mapDirections(destination: String) {
            runOnUiThread {
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("google.navigation:q=${Uri.encode(destination)}")).setPackage("com.google.android.apps.maps"))
                } catch (_: Exception) {
                    try { openWeb("https://www.google.com/maps/dir/?api=1&destination=${Uri.encode(destination)}") }
                    catch (_: Exception) { Toast.makeText(this@MainActivity, "Maps unavailable", Toast.LENGTH_SHORT).show() }
                }
            }
        }

        @JavascriptInterface fun setAlarm(hour: Int, minute: Int, message: String) {
            runOnUiThread {
                try {
                    startActivity(Intent(AlarmClock.ACTION_SET_ALARM).apply {
                        putExtra(AlarmClock.EXTRA_HOUR, hour)
                        putExtra(AlarmClock.EXTRA_MINUTES, minute)
                        putExtra(AlarmClock.EXTRA_MESSAGE, message)
                    })
                } catch (_: Exception) { Toast.makeText(this@MainActivity, "Alarm app unavailable", Toast.LENGTH_SHORT).show() }
            }
        }

        @JavascriptInterface fun openService(key: String, label: String, webUrl: String) {
            runOnUiThread {
                val aliases = mapOf(
                    "maps" to "com.google.android.apps.maps", "swiggy" to "in.swiggy.android",
                    "blinkit" to "com.grofers.customerapp", "zomato" to "com.application.zomato",
                    "gmail" to "com.google.android.gm", "calendar" to "com.google.android.calendar",
                    "youtube" to "com.google.android.youtube", "spotify" to "com.spotify.music",
                    "uber" to "com.ubercab", "ola" to "com.olacabs.customer",
                    "keep" to "com.google.android.keep", "whatsapp" to "com.whatsapp"
                )
                try {
                    val pkg = aliases[key.lowercase(Locale.getDefault())]
                    val appIntent = pkg?.let { packageManager.getLaunchIntentForPackage(it) }
                    if (appIntent != null) startActivity(appIntent) else openWeb(webUrl)
                } catch (_: Exception) {
                    try { openWeb(webUrl) } catch (_: Exception) { Toast.makeText(this@MainActivity, "Couldn't open $label", Toast.LENGTH_SHORT).show() }
                }
            }
        }

        @JavascriptInterface fun openWeb(url: String) {
            runOnUiThread {
                try {
                    val clean = url.trim()
                    val safeUrl = if (clean.startsWith("http://") || clean.startsWith("https://")) clean else "https://$clean"
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(safeUrl)))
                } catch (_: Exception) { Toast.makeText(this@MainActivity, "Couldn't open that link", Toast.LENGTH_SHORT).show() }
            }
        }

        @JavascriptInterface fun openDialer(number: String) {
            runOnUiThread {
                try { startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${Uri.encode(number)}"))) }
                catch (_: Exception) { Toast.makeText(this@MainActivity, "Dialer unavailable", Toast.LENGTH_SHORT).show() }
            }
        }

        @JavascriptInterface fun createCalendarEvent(title: String, startMillis: Long, endMillis: Long) {
            runOnUiThread {
                try {
                    startActivity(Intent(Intent.ACTION_INSERT).setData(CalendarContract.Events.CONTENT_URI).apply {
                        putExtra(CalendarContract.Events.TITLE, title)
                        putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, startMillis)
                        putExtra(CalendarContract.EXTRA_EVENT_END_TIME, endMillis)
                    })
                } catch (_: Exception) { Toast.makeText(this@MainActivity, "Calendar unavailable", Toast.LENGTH_SHORT).show() }
            }
        }

        @JavascriptInterface fun composeEmail(to: String, subject: String, body: String) {
            runOnUiThread {
                val i = Intent(Intent.ACTION_SENDTO).setData(Uri.parse("mailto:")).apply {
                    putExtra(Intent.EXTRA_EMAIL, arrayOf(to))
                    putExtra(Intent.EXTRA_SUBJECT, subject)
                    putExtra(Intent.EXTRA_TEXT, body)
                }
                startActivity(Intent.createChooser(i, "Send with"))
            }
        }

        @JavascriptInterface fun openSettings(page: String) {
            runOnUiThread {
                val action = when (page.lowercase(Locale.getDefault())) {
                    "wifi" -> Settings.ACTION_WIFI_SETTINGS
                    "bluetooth" -> Settings.ACTION_BLUETOOTH_SETTINGS
                    "sound" -> Settings.ACTION_SOUND_SETTINGS
                    "display" -> Settings.ACTION_DISPLAY_SETTINGS
                    "apps" -> Settings.ACTION_APPLICATION_SETTINGS
                    "battery" -> Settings.ACTION_BATTERY_SAVER_SETTINGS
                    "assistant" -> Settings.ACTION_VOICE_INPUT_SETTINGS
                    else -> Settings.ACTION_SETTINGS
                }
                try { startActivity(Intent(action)) }
                catch (_: Exception) { Toast.makeText(this@MainActivity, "Settings unavailable", Toast.LENGTH_SHORT).show() }
            }
        }

        @JavascriptInterface fun openAccessibilitySettings() {
            runOnUiThread { try { startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) } catch (_: Exception) {} }
        }

        @JavascriptInterface fun isAutomationEnabled(): Boolean = GuhanAccessibilityService.isEnabled()
        @JavascriptInterface fun clickVisibleText(text: String): Boolean = GuhanAccessibilityService.clickVisibleText(text)
        @JavascriptInterface fun globalBack(): Boolean = GuhanAccessibilityService.globalBack()
        @JavascriptInterface fun globalHome(): Boolean = GuhanAccessibilityService.globalHome()
        @JavascriptInterface fun globalRecents(): Boolean = GuhanAccessibilityService.globalRecents()

        @JavascriptInterface fun speak(text: String) {
            runOnUiThread { web.evaluateJavascript("window.guhanSpeak && window.guhanSpeak(${org.json.JSONObject.quote(text)})", null) }
        }

        @JavascriptInterface fun startVoiceSession() {
            try { GuhanVoiceSessionService.start(this@MainActivity) }
            catch (_: Exception) { Toast.makeText(this@MainActivity, "Voice session unavailable", Toast.LENGTH_SHORT).show() }
        }

        @JavascriptInterface fun stopVoiceSession() {
            try { GuhanVoiceSessionService.stop(this@MainActivity) } catch (_: Exception) {}
        }

        @JavascriptInterface fun isVoiceSessionActive(): Boolean = GuhanVoiceSessionService.isRunning

        @JavascriptInterface fun voiceInput() {
            runOnUiThread {
                val i = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN")
                    putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak to G.U.H.A.N.")
                }
                try { startActivityForResult(i, REQUEST_VOICE) }
                catch (_: Exception) { Toast.makeText(this@MainActivity, "Voice recognition unavailable", Toast.LENGTH_SHORT).show() }
            }
        }

        @JavascriptInterface fun isSystemAssistant(): Boolean = GuhanVoiceInteractionService.isActiveService(this@MainActivity)

        @JavascriptInterface fun getDeviceContext(): String {
            return try {
                val battery = registerReceiver(null, android.content.IntentFilter(Intent.ACTION_BATTERY_CHANGED))
                val level = battery?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
                val scale = battery?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
                val charging = battery?.getIntExtra(BatteryManager.EXTRA_STATUS, -1)?.let {
                    it == BatteryManager.BATTERY_STATUS_CHARGING || it == BatteryManager.BATTERY_STATUS_FULL
                } ?: false
                val cm = getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager
                val network = cm.activeNetwork
                val capabilities = network?.let { cm.getNetworkCapabilities(it) }
                val online = capabilities != null
                val metrics = DisplayMetrics()
                windowManager.defaultDisplay.getMetrics(metrics)
                org.json.JSONObject().apply {
                    put("batteryPercent", if (level >= 0 && scale > 0) (level * 100 / scale) else org.json.JSONObject.NULL)
                    put("charging", charging)
                    put("networkAvailable", online)
                    put("locale", Locale.getDefault().toLanguageTag())
                    put("timezone", java.util.TimeZone.getDefault().id)
                    put("screenWidth", metrics.widthPixels)
                    put("screenHeight", metrics.heightPixels)
                    put("systemAssistant", GuhanVoiceInteractionService.isActiveService(this@MainActivity))
                    put("accessibilityAutomation", GuhanAccessibilityService.isEnabled())
                }.toString()
            } catch (_: Exception) { "{}" }
        }

        @JavascriptInterface fun openAssistantSettings() {
            runOnUiThread {
                try { startActivity(Intent(Settings.ACTION_VOICE_INPUT_SETTINGS)) }
                catch (_: Exception) { startActivity(Intent(Settings.ACTION_SETTINGS)) }
            }
        }
    }

    private fun launchPackage(packageName: String): Boolean {
        return try {
            val intent = packageManager.getLaunchIntentForPackage(packageName) ?: return false
            startActivity(intent); true
        } catch (_: Exception) { false }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_VOICE && resultCode == RESULT_OK) {
            val text = data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull() ?: return
            web.evaluateJavascript("window.guhanVoiceResult && window.guhanVoiceResult(${org.json.JSONObject.quote(text)})", null)
        }
    }

    override fun onResume() {
        super.onResume()
        if (assistantInvocation && ::web.isInitialized) {
            web.postDelayed({
                web.evaluateJavascript("window.guhanAssistantInvoked && window.guhanAssistantInvoked()", null)
                assistantInvocation = false
            }, 350)
        }
    }

    companion object { private const val REQUEST_VOICE = 42 }
}
