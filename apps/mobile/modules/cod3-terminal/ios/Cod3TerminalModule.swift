import ExpoModulesCore

public class Cod3TerminalModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Cod3TerminalSurface")

    // Bumped when native hardware-keyboard handling changes; surfaced in the JS debug
    // logs so a stale native binary is distinguishable from a broken key pipeline.
    Constants([
      "hardwareKeyRevision": 4,
      "outputRevision": 1,
    ])

    View(Cod3TerminalView.self) {
      AsyncFunction("writeOutput") { (view: Cod3TerminalView, data: String, reset: Bool) in
        view.writeOutput(data, reset: reset)
      }

      AsyncFunction("resetInput") { (view: Cod3TerminalView) in
        view.resetInputField()
      }

      Prop("terminalKey") { (view: Cod3TerminalView, terminalKey: String) in
        view.terminalKey = terminalKey
      }

      Prop("initialBuffer") { (view: Cod3TerminalView, initialBuffer: String) in
        view.initialBuffer = initialBuffer
      }

      Prop("fontSize") { (view: Cod3TerminalView, fontSize: Double) in
        view.fontSize = CGFloat(fontSize)
      }

      Prop("focusRequest") { (view: Cod3TerminalView, focusRequest: Double) in
        view.focusRequest = focusRequest
      }

      Prop("readOnly") { (view: Cod3TerminalView, readOnly: Bool) in
        view.readOnly = readOnly
      }

      Prop("autoFocus") { (view: Cod3TerminalView, autoFocus: Bool) in
        view.autoFocus = autoFocus
      }

      Prop("appearanceScheme") { (view: Cod3TerminalView, appearanceScheme: String) in
        view.appearanceScheme = appearanceScheme
      }

      Prop("themeConfig") { (view: Cod3TerminalView, themeConfig: String) in
        view.themeConfig = themeConfig
      }

      Prop("backgroundColor") { (view: Cod3TerminalView, backgroundColor: String) in
        view.backgroundColorHex = backgroundColor
      }

      Prop("foregroundColor") { (view: Cod3TerminalView, foregroundColor: String) in
        view.foregroundColorHex = foregroundColor
      }

      Prop("mutedForegroundColor") { (view: Cod3TerminalView, mutedForegroundColor: String) in
        view.mutedForegroundColorHex = mutedForegroundColor
      }

      Prop("captureRequest") { (view: Cod3TerminalView, request: Double) in
        view.captureRequest = request
      }

      Prop("sharedGrid") { (view: Cod3TerminalView, sharedGrid: [Int]) in
        view.sharedGrid = sharedGrid
      }
      Events("onInput", "onResize", "onCapture", "onPaste")

      OnViewDidUpdateProps { (view: Cod3TerminalView) in
        view.applyPendingBuffer()
      }
    }
  }
}
