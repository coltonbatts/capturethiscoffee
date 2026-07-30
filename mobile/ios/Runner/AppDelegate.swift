import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  private var summaryShareChannel: FlutterMethodChannel?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    let channel = FlutterMethodChannel(
      name: "com.capturethis.ctcprinter/summary-share",
      binaryMessenger: engineBridge.applicationRegistrar.messenger()
    )
    channel.setMethodCallHandler { [weak self] call, result in
      guard call.method == "shareText" else {
        result(FlutterMethodNotImplemented)
        return
      }
      guard
        let arguments = call.arguments as? [String: Any],
        let text = arguments["text"] as? String,
        !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      else {
        result(
          FlutterError(
            code: "invalid_share_content",
            message: "The summary is empty.",
            details: nil
          )
        )
        return
      }

      DispatchQueue.main.async {
        guard
          let root = self?.window?.rootViewController,
          let presenter = self?.topViewController(from: root)
        else {
          result(
            FlutterError(
              code: "share_unavailable",
              message: "The share sheet is unavailable.",
              details: nil
            )
          )
          return
        }
        let activity = UIActivityViewController(
          activityItems: [text],
          applicationActivities: nil
        )
        activity.popoverPresentationController?.sourceView = presenter.view
        activity.popoverPresentationController?.sourceRect = CGRect(
          x: presenter.view.bounds.midX,
          y: presenter.view.bounds.midY,
          width: 1,
          height: 1
        )
        presenter.present(activity, animated: true) {
          result(nil)
        }
      }
    }
    summaryShareChannel = channel
  }

  private func topViewController(from root: UIViewController) -> UIViewController {
    if let presented = root.presentedViewController {
      return topViewController(from: presented)
    }
    if let navigation = root as? UINavigationController,
       let visible = navigation.visibleViewController {
      return topViewController(from: visible)
    }
    if let tabs = root as? UITabBarController,
       let selected = tabs.selectedViewController {
      return topViewController(from: selected)
    }
    return root
  }
}
