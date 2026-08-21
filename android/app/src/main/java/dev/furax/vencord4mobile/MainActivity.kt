/*
 * Vencord4Mobile
 * Loads discord.com in a full-screen WebView and injects the Vencord bundle
 * by intercepting the HTML response, stripping CSP headers and prepending
 * a <script> tag before Discord's own scripts.
 */
package dev.furax.vencord4mobile

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.webkit.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature
import kotlinx.coroutines.*
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.ByteArrayInputStream

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    // Loaded once from assets at startup
    private lateinit var vencordJs: String

    // HTTP client used to fetch Discord pages so we can strip CSP headers
    private val http = OkHttpClient()

    // ── File chooser for uploads ──────────────────────────────────────────
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private val filePicker = registerForActivityResult(
        ActivityResultContracts.GetMultipleContents()
    ) { uris ->
        fileCallback?.onReceiveValue(uris.toTypedArray())
        fileCallback = null
    }

    // ── Runtime permissions (mic / camera for voice & video) ─────────────
    private val permLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { /* WebView handles grant/deny internally */ }

    // ─────────────────────────────────────────────────────────────────────
    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)

        // Read Vencord bundle from assets (blocking – tiny file, acceptable on main)
        vencordJs = assets.open("vencord.js").bufferedReader().readText()

        webView = WebView(this).apply {
            settings.apply {
                javaScriptEnabled         = true
                domStorageEnabled         = true
                databaseEnabled           = true
                mediaPlaybackRequiresUserGesture = false
                mixedContentMode          = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                allowFileAccess           = false
                cacheMode                 = WebSettings.LOAD_DEFAULT
                setSupportZoom(false)
                // Pretend to be desktop Chrome so Discord serves its full web app
                userAgentString =
                    "Mozilla/5.0 (X11; Linux x86_64) " +
                    "AppleWebKit/537.36 (KHTML, like Gecko) " +
                    "Chrome/128.0.0.0 Safari/537.36"
            }

            if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING))
                WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings, true)

            webViewClient  = VencordWebViewClient()
            webChromeClient = VencordChromeClient()

            if (savedInstanceState != null) restoreState(savedInstanceState)
            else loadUrl("https://discord.com/app")
        }

        setContentView(webView)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        scope.cancel()
        webView.destroy()
        super.onDestroy()
    }

    // ── WebViewClient ─────────────────────────────────────────────────────
    private inner class VencordWebViewClient : WebViewClient() {

        private val discordHosts = setOf("discord.com", "www.discord.com")

        // Intercept every request from Discord's domain that asks for HTML.
        // We re-fetch it ourselves via OkHttp so we can:
        //   • strip Content-Security-Policy (would block our injected script)
        //   • inject <script>vencordJs</script> right after <head>
        override fun shouldInterceptRequest(
            view: WebView,
            request: WebResourceRequest
        ): WebResourceResponse? {
            val host   = request.url.host ?: return null
            val accept = request.requestHeaders["Accept"] ?: ""

            if (host !in discordHosts) return null
            if (!accept.contains("text/html")) return null

            return runBlocking { fetchAndPatch(request) }
        }

        private fun fetchAndPatch(request: WebResourceRequest): WebResourceResponse? {
            return try {
                val req = Request.Builder().url(request.url.toString()).apply {
                    request.requestHeaders.forEach { (k, v) ->
                        if (k.lowercase() !in setOf("host", "content-length"))
                            runCatching { header(k, v) }
                    }
                }.build()

                val resp = http.newCall(req).execute()
                val body = resp.body?.string() ?: return null

                // Inject Vencord + fix viewport for Android edge-to-edge safe areas
                val patched = body
                    .replaceFirst(
                        "<head>",
                        "<head><script>$vencordJs</script>"
                    )
                    .replace(
                        Regex("""<meta\s+name=["']viewport["'][^>]*>""", RegexOption.IGNORE_CASE),
                        "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">"
                    )

                // Rebuild headers without CSP
                val headers = mutableMapOf<String, String>()
                resp.headers.forEach { (name, value) ->
                    if (name.lowercase() !in setOf(
                            "content-security-policy",
                            "content-security-policy-report-only",
                            "x-frame-options",
                            "content-encoding",  // we decoded it already
                            "content-length"
                        )
                    ) headers[name] = value
                }
                headers["Content-Type"] = "text/html; charset=utf-8"

                WebResourceResponse(
                    "text/html", "utf-8",
                    resp.code, resp.message.ifEmpty { "OK" },
                    headers,
                    ByteArrayInputStream(patched.toByteArray(Charsets.UTF_8))
                )
            } catch (_: Exception) {
                null  // fall back to default WebView loading
            }
        }

        override fun onReceivedError(
            view: WebView,
            request: WebResourceRequest,
            error: WebResourceError
        ) {
            if (request.isForMainFrame) view.loadData(offlinePage, "text/html", "utf-8")
        }
    }

    // ── WebChromeClient ───────────────────────────────────────────────────
    private inner class VencordChromeClient : WebChromeClient() {

        override fun onPermissionRequest(request: PermissionRequest) {
            val androidPerms = request.resources.mapNotNull {
                when (it) {
                    PermissionRequest.RESOURCE_AUDIO_CAPTURE -> Manifest.permission.RECORD_AUDIO
                    PermissionRequest.RESOURCE_VIDEO_CAPTURE -> Manifest.permission.CAMERA
                    else -> null
                }
            }
            val missing = androidPerms.filter {
                ContextCompat.checkSelfPermission(this@MainActivity, it) !=
                    PackageManager.PERMISSION_GRANTED
            }
            if (missing.isNotEmpty()) permLauncher.launch(missing.toTypedArray())
            request.grant(request.resources)
        }

        override fun onShowFileChooser(
            webView: WebView,
            filePathCallback: ValueCallback<Array<Uri>>,
            fileChooserParams: FileChooserParams
        ): Boolean {
            fileCallback?.onReceiveValue(null)
            fileCallback = filePathCallback
            filePicker.launch("*/*")
            return true
        }

        override fun onConsoleMessage(msg: ConsoleMessage): Boolean {
            if (BuildConfig.DEBUG)
                android.util.Log.d("Vencord", "[${msg.sourceId()}:${msg.lineNumber()}] ${msg.message()}")
            return true
        }
    }

    // ── Offline fallback page ─────────────────────────────────────────────
    private val offlinePage = """
        <!DOCTYPE html><html><head>
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <style>
          body{margin:0;display:flex;flex-direction:column;align-items:center;
               justify-content:center;height:100vh;background:#1e1f22;
               color:#dbdee1;font-family:sans-serif;text-align:center;padding:1em}
          button{margin-top:1.5em;padding:.75em 2em;border:none;border-radius:4px;
                 background:#5865f2;color:#fff;font-size:1em;cursor:pointer}
        </style></head>
        <body>
          <h2>Pas de connexion</h2>
          <p>Vérifie ton réseau puis réessaie.</p>
          <button onclick="location.reload()">Réessayer</button>
        </body></html>
    """.trimIndent()
}
