package expo.modules.cod3reviewdiff

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private val REVIEW_DIFF_EVENTS = arrayOf(
  "onDebug",
  "onVisibleFileChange",
  "onToggleFile",
  "onToggleViewedFile",
  "onPressLine",
  "onToggleComment",
  "onPressNotice",
)

class Cod3ReviewDiffModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Cod3ReviewDiffSurface")

    View(Cod3ReviewDiffView::class) {
      Prop("tokensResetKey") { view: Cod3ReviewDiffView, tokensResetKey: String ->
        view.setTokensResetKey(tokensResetKey)
      }
      Prop("contentResetKey") { view: Cod3ReviewDiffView, contentResetKey: String ->
        view.setContentResetKey(contentResetKey)
      }
      Prop("collapsedFileIdsJson") { view: Cod3ReviewDiffView, collapsedFileIdsJson: String ->
        view.setCollapsedFileIdsJson(collapsedFileIdsJson)
      }
      Prop("viewedFileIdsJson") { view: Cod3ReviewDiffView, viewedFileIdsJson: String ->
        view.setViewedFileIdsJson(viewedFileIdsJson)
      }
      Prop("selectedRowIdsJson") { view: Cod3ReviewDiffView, selectedRowIdsJson: String ->
        view.setSelectedRowIdsJson(selectedRowIdsJson)
      }
      Prop("collapsedCommentIdsJson") { view: Cod3ReviewDiffView, collapsedCommentIdsJson: String ->
        view.setCollapsedCommentIdsJson(collapsedCommentIdsJson)
      }
      Prop("appearanceScheme") { view: Cod3ReviewDiffView, appearanceScheme: String ->
        view.setAppearanceScheme(appearanceScheme)
      }
      Prop("themeJson") { view: Cod3ReviewDiffView, themeJson: String ->
        view.setThemeJson(themeJson)
      }
      Prop("styleJson") { view: Cod3ReviewDiffView, styleJson: String ->
        view.setStyleJson(styleJson)
      }
      Prop("rowHeight") { view: Cod3ReviewDiffView, rowHeight: Double ->
        view.setRowHeight(rowHeight.toFloat())
      }
      // Accept the shared prop while deriving Android's scroll range from the drawn text.
      Prop("contentWidth") { _: Cod3ReviewDiffView, _: Double -> }
      Prop("contentInsetBottom") { view: Cod3ReviewDiffView, value: Double ->
        view.setContentInsetBottom(value.toFloat())
      }
      Prop("scrollEnabled") { view: Cod3ReviewDiffView, enabled: Boolean ->
        view.setScrollEnabled(enabled)
      }
      Prop("initialRowIndex") { view: Cod3ReviewDiffView, initialRowIndex: Double ->
        view.setInitialRowIndex(initialRowIndex)
      }
      Prop("initialFileId") { view: Cod3ReviewDiffView, fileId: String ->
        view.setInitialFileId(fileId)
      }

      Events(REVIEW_DIFF_EVENTS)

      AsyncFunction("scrollToFile") { view: Cod3ReviewDiffView, fileId: String, animated: Boolean ->
        view.scrollToFile(fileId, animated)
      }
      AsyncFunction("scrollToTop") { view: Cod3ReviewDiffView, animated: Boolean ->
        view.scrollToTop(animated)
      }
      AsyncFunction("setRowsJson") { view: Cod3ReviewDiffView, rowsJson: String, resetKey: String ->
        view.setContentResetKey(resetKey)
        view.setRowsJson(rowsJson)
      }
      AsyncFunction("setTokensJson") { view: Cod3ReviewDiffView, tokensJson: String ->
        view.setTokensJson(tokensJson)
      }
      AsyncFunction("setTokensPatchJson") {
          view: Cod3ReviewDiffView,
          tokensPatchJson: String,
          promise: Promise
        ->
        view.setTokensPatchJson(tokensPatchJson) { accepted -> promise.resolve(accepted) }
      }

      OnViewDestroys { view: Cod3ReviewDiffView ->
        view.cleanup()
      }
    }
  }
}
