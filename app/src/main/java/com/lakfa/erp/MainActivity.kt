package com.lakfa.erp

import android.annotation.SuppressLint
import android.net.Uri
import android.os.Bundle
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView

private const val ERP_ASSET_URL = "file:///android_asset/lakfa-erp/index.html"

class MainActivity : ComponentActivity() {
  private var webView: WebView? = null
  private var fileChooserCallback: ValueCallback<Array<Uri>>? = null

  private val filePicker = registerForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
    fileChooserCallback?.onReceiveValue(uris.toTypedArray())
    fileChooserCallback = null
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()

    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        val activeWebView = webView
        if (activeWebView?.canGoBack() == true) {
          activeWebView.goBack()
        } else {
          finish()
        }
      }
    })

    setContent {
      Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
        LakfaWebView(
          modifier = Modifier.padding(innerPadding),
          onWebViewCreated = { webView = it },
          onFilePickerRequested = { callback ->
            fileChooserCallback?.onReceiveValue(null)
            fileChooserCallback = callback
            filePicker.launch("image/*")
          }
        )
      }
    }
  }

  override fun onDestroy() {
    webView?.destroy()
    webView = null
    fileChooserCallback?.onReceiveValue(null)
    fileChooserCallback = null
    super.onDestroy()
  }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun LakfaWebView(
  modifier: Modifier = Modifier,
  onWebViewCreated: (WebView) -> Unit,
  onFilePickerRequested: (ValueCallback<Array<Uri>>) -> Unit
) {
  AndroidView(
    factory = { context ->
      WebView(context).apply {
        onWebViewCreated(this)
        webViewClient = WebViewClient()
        webChromeClient = object : WebChromeClient() {
          override fun onShowFileChooser(
            webView: WebView?,
            filePathCallback: ValueCallback<Array<Uri>>?,
            fileChooserParams: FileChooserParams?
          ): Boolean {
            if (filePathCallback == null) return false
            onFilePickerRequested(filePathCallback)
            return true
          }
        }
        settings.apply {
          javaScriptEnabled = true
          domStorageEnabled = true
          databaseEnabled = true
          cacheMode = WebSettings.LOAD_DEFAULT
          allowFileAccess = true
          allowContentAccess = true
          loadsImagesAutomatically = true
          mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
          setSupportZoom(false)
          @Suppress("DEPRECATION")
          allowFileAccessFromFileURLs = true
          @Suppress("DEPRECATION")
          allowUniversalAccessFromFileURLs = true
        }
        loadUrl(ERP_ASSET_URL)
      }
    },
    modifier = modifier.fillMaxSize()
  )
}
