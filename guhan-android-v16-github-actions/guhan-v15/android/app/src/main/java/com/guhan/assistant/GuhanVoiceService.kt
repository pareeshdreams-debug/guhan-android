package com.guhan.assistant

import android.content.Intent
import android.os.Bundle
import android.service.voice.VoiceInteractionService
import android.service.voice.VoiceInteractionSession
import android.service.voice.VoiceInteractionSessionService

/** Lightweight global assistant service. Heavy UI is launched by the session. */
class GuhanVoiceInteractionService : VoiceInteractionService() {
    override fun onReady() {
        super.onReady()
        // The system owns lifecycle/background execution. No continuous microphone loop here.
    }

    companion object {
        fun isActiveService(context: android.content.Context): Boolean =
            VoiceInteractionService.isActiveService(context, GuhanVoiceInteractionService::class.java)
    }
}

class GuhanVoiceInteractionSessionService : VoiceInteractionSessionService() {
    override fun onNewSession(args: Bundle?): VoiceInteractionSession = GuhanVoiceInteractionSession(this)
}

class GuhanVoiceInteractionSession(service: VoiceInteractionSessionService) : VoiceInteractionSession(service) {
    override fun onShow(args: Bundle?, showFlags: Int) {
        super.onShow(args, showFlags)
        val intent = Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra("GUHAN_ASSISTANT_INVOCATION", true)
        }
        context.startActivity(intent)
        hide()
    }
}
