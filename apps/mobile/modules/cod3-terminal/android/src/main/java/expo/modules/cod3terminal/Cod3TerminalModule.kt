package expo.modules.cod3terminal

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class Cod3TerminalModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Cod3TerminalSurface")

    // Bumped when native hardware-keyboard handling changes; surfaced in the JS debug
    // logs so a stale native binary is distinguishable from a broken key pipeline.
    Constants(
      "hardwareKeyRevision" to 2,
      "outputRevision" to 1,
    )

    View(Cod3TerminalView::class) {
      AsyncFunction("writeOutput") { view: Cod3TerminalView, data: String, reset: Boolean ->
        view.writeOutput(data, reset)
      }

      // The Android input field already clears after every change.
      AsyncFunction("resetInput") { _: Cod3TerminalView -> }

      Prop("terminalKey") { view: Cod3TerminalView, terminalKey: String ->
        view.terminalKey = terminalKey
      }

      Prop("initialBuffer") { view: Cod3TerminalView, initialBuffer: String ->
        view.initialBuffer = initialBuffer
      }

      Prop("fontSize") { view: Cod3TerminalView, fontSize: Double ->
        view.fontSize = fontSize.toFloat()
      }

      Prop("focusRequest") { view: Cod3TerminalView, focusRequest: Double ->
        view.focusRequest = focusRequest
      }

      Prop("readOnly") { view: Cod3TerminalView, readOnly: Boolean ->
        view.readOnly = readOnly
      }

      Prop("autoFocus") { view: Cod3TerminalView, autoFocus: Boolean ->
        view.autoFocus = autoFocus
      }

      Prop("appearanceScheme") { view: Cod3TerminalView, appearanceScheme: String ->
        view.appearanceScheme = appearanceScheme
      }

      Prop("themeConfig") { view: Cod3TerminalView, themeConfig: String ->
        view.themeConfig = themeConfig
      }

      Prop("backgroundColor") { view: Cod3TerminalView, backgroundColor: String ->
        view.backgroundColorHex = backgroundColor
      }

      Prop("foregroundColor") { view: Cod3TerminalView, foregroundColor: String ->
        view.foregroundColorHex = foregroundColor
      }

      Prop("mutedForegroundColor") { view: Cod3TerminalView, mutedForegroundColor: String ->
        view.mutedForegroundColorHex = mutedForegroundColor
      }

      Prop("captureRequest") { view: Cod3TerminalView, request: Double ->
        view.captureRequest = request
      }

      Prop("sharedGrid") { view: Cod3TerminalView, sharedGrid: List<Int> ->
        view.sharedGrid = sharedGrid
      }
      Events("onInput", "onResize", "onCapture")

      OnViewDidUpdateProps { view: Cod3TerminalView ->
        view.applyPendingBuffer()
      }

      OnViewDestroys { view: Cod3TerminalView ->
        view.cleanup()
      }
    }
  }
}
