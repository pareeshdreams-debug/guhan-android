package com.guhan.assistant

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Optional user-enabled accessibility bridge for accessibility-oriented UI assistance.
 * Android requires the user to explicitly enable this service in Settings.
 */
class GuhanAccessibilityService : AccessibilityService() {
    companion object {
        @Volatile private var instance: GuhanAccessibilityService? = null
        private val protectedWords = Regex("\\b(buy|order|pay|checkout|purchase|delete|remove|send|confirm|place order)\\b", RegexOption.IGNORE_CASE)

        fun isEnabled(): Boolean = instance != null

        fun clickVisibleText(text: String): Boolean {
            if (text.isBlank() || protectedWords.containsMatchIn(text)) return false
            val service = instance ?: return false
            val nodes = service.rootInActiveWindow?.findAccessibilityNodeInfosByText(text) ?: return false
            return nodes.any { clickNodeOrParent(it) }
        }

        fun globalBack(): Boolean = instance?.performGlobalAction(GLOBAL_ACTION_BACK) == true
        fun globalHome(): Boolean = instance?.performGlobalAction(GLOBAL_ACTION_HOME) == true
        fun globalRecents(): Boolean = instance?.performGlobalAction(GLOBAL_ACTION_RECENTS) == true

        private fun clickNodeOrParent(node: AccessibilityNodeInfo): Boolean {
            if (node.isClickable) return node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
            var parent = node.parent
            while (parent != null) {
                if (parent.isClickable) return parent.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                parent = parent.parent
            }
            return false
        }
    }

    override fun onServiceConnected() { super.onServiceConnected(); instance = this }
    override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit
    override fun onInterrupt() = Unit
    override fun onDestroy() { instance = null; super.onDestroy() }
}
