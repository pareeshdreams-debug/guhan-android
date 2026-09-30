package com.guhan.assistant

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder

/**
 * User-visible voice-session coordinator.
 *
 * V13 intentionally uses Android's bounded shortService type rather than a
 * hidden always-on microphone service. The actual speech recognizer remains
 * user-invoked from the foreground assistant UI.
 */
class GuhanVoiceSessionService : Service() {
    override fun onCreate() {
        super.onCreate()
        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            isRunning = false
            stopSelf()
            return START_NOT_STICKY
        }

        isRunning = true
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
        return START_NOT_STICKY
    }

    override fun onTimeout(startId: Int) {
        stopSelf()
    }

    override fun onDestroy() {
        isRunning = false
        stopForeground(STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun buildNotification(): Notification {
        val stopIntent = Intent(this, GuhanVoiceSessionService::class.java).setAction(ACTION_STOP)
        val stopPending = PendingIntent.getService(
            this,
            20,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val openIntent = PendingIntent.getActivity(
            this,
            21,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle("G.U.H.A.N. voice session")
            .setContentText("Voice mode is active and user-controlled.")
            .setContentIntent(openIntent)
            .setOngoing(true)
            .setCategory(Notification.CATEGORY_SERVICE)
            .addAction(Notification.Action.Builder(null, "Stop", stopPending).build())
            .build()
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "G.U.H.A.N. Voice Session",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Visible notification while G.U.H.A.N. voice mode is active."
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    companion object {
        const val ACTION_START = "com.guhan.assistant.action.START_VOICE_SESSION"
        const val ACTION_STOP = "com.guhan.assistant.action.STOP_VOICE_SESSION"
        private const val CHANNEL_ID = "guhan_voice_session"
        private const val NOTIFICATION_ID = 1301
        @Volatile var isRunning: Boolean = false

        fun start(context: android.content.Context) {
            val intent = Intent(context, GuhanVoiceSessionService::class.java).setAction(ACTION_START)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent)
            else context.startService(intent)
        }

        fun stop(context: android.content.Context) {
            context.stopService(Intent(context, GuhanVoiceSessionService::class.java))
        }
    }
}
