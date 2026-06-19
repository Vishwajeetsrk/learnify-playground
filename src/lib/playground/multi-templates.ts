// Multi-file project templates (native mobile starters with folders + assets).
import type { LangKey } from "@/lib/executors";
import type { Track } from "./templates";

export interface MultiFile {
  path: string;         // e.g. "src/MainActivity.kt"
  content: string;
}

export interface MultiTemplate {
  id: string;
  kind: "multi";
  name: string;
  icon: string;
  description: string;
  tracks: Track[];
  language: LangKey;    // primary language for AI/run
  folders: string[];    // explicit folder list (so empty folders persist)
  files: MultiFile[];
  activePath?: string;  // default file to open
}

// ---------------------------------------------------------------------------
// Native Mobile templates — each ships with src/ + assets/ folders.

const androidKotlin: MultiTemplate = {
  id: "android-kotlin-app",
  kind: "multi",
  name: "Android · Kotlin App",
  icon: "android",
  description: "Multi-file Kotlin/Compose Android starter with src/ and assets/ folders.",
  tracks: ["mobile"],
  language: "kotlin",
  folders: ["src", "src/ui", "res/layout", "res/values", "assets"],
  activePath: "src/MainActivity.kt",
  files: [
    { path: "src/MainActivity.kt", content: `package com.example.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContent {
      MaterialTheme {
        var count by remember { mutableStateOf(0) }
        Surface {
          Column(Modifier.padding(24.dp)) {
            Text("Hello, Android!", style = MaterialTheme.typography.headlineMedium)
            Spacer(Modifier.height(12.dp))
            Text("Taps: $count")
            Spacer(Modifier.height(12.dp))
            Button(onClick = { count++ }) { Text("Tap me") }
          }
        }
      }
    }
  }
}
` },
    { path: "src/ui/Greeting.kt", content: `package com.example.app.ui

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable

@Composable
fun Greeting(name: String) {
  Text("Hello, $name!")
}
` },
    { path: "res/layout/activity_main.xml", content: `<?xml version="1.0" encoding="utf-8"?>
<androidx.constraintlayout.widget.ConstraintLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent">
  <TextView android:id="@+id/label"
    android:layout_width="wrap_content"
    android:layout_height="wrap_content"
    android:text="Hello, Android!" />
</androidx.constraintlayout.widget.ConstraintLayout>
` },
    { path: "res/values/strings.xml", content: `<resources>
  <string name="app_name">MyApp</string>
</resources>
` },
    { path: "README.md", content: `# Android Kotlin Starter

Drop \`src/\` into \`app/src/main/java/com/example/app/\` and \`res/\` into \`app/src/main/res/\` in an Android Studio project. Add image / PDF assets to the \`assets/\` folder.
` },
  ],
};

const iosSwift: MultiTemplate = {
  id: "ios-swift-app",
  kind: "multi",
  name: "iOS · Swift App",
  icon: "swift",
  description: "Multi-file SwiftUI iOS starter with sources and assets folder.",
  tracks: ["mobile"],
  language: "swift",
  folders: ["Sources", "Sources/Views", "Resources", "assets"],
  activePath: "Sources/App.swift",
  files: [
    { path: "Sources/App.swift", content: `import SwiftUI

@main
struct MyApp: App {
  var body: some Scene {
    WindowGroup { ContentView() }
  }
}
` },
    { path: "Sources/ContentView.swift", content: `import SwiftUI

struct ContentView: View {
  @State private var count = 0
  var body: some View {
    VStack(spacing: 16) {
      Text("Hello, iOS!").font(.largeTitle).bold()
      Text("Taps: \\(count)")
      Button("Tap me") { count += 1 }
        .buttonStyle(.borderedProminent)
    }
    .padding()
  }
}
` },
    { path: "Sources/Views/Greeting.swift", content: `import SwiftUI

struct Greeting: View {
  let name: String
  var body: some View { Text("Hello, \\(name)!") }
}
` },
    { path: "Resources/Info.plist", content: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>MyApp</string>
  <key>CFBundleIdentifier</key><string>com.example.MyApp</string>
</dict></plist>
` },
    { path: "README.md", content: `# iOS Swift Starter

Open in Xcode. Add image / PDF assets under \`assets/\` and reference them from your bundle.
` },
  ],
};

const flutterApp: MultiTemplate = {
  id: "flutter-app",
  kind: "multi",
  name: "Flutter · Dart App",
  icon: "flutter",
  description: "Multi-file Flutter starter with lib/, test/, and assets folders.",
  tracks: ["mobile"],
  language: "dart",
  folders: ["lib", "lib/screens", "test", "assets"],
  activePath: "lib/main.dart",
  files: [
    { path: "lib/main.dart", content: `import 'package:flutter/material.dart';
import 'screens/home_screen.dart';

void main() => runApp(const MyApp());

class MyApp extends StatelessWidget {
  const MyApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'My App',
    theme: ThemeData(colorSchemeSeed: Colors.indigo, useMaterial3: true),
    home: const HomeScreen(),
  );
}
` },
    { path: "lib/screens/home_screen.dart", content: `import 'package:flutter/material.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _count = 0;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Flutter Starter')),
    body: Center(
      child: Text('Taps: \$_count', style: const TextStyle(fontSize: 28)),
    ),
    floatingActionButton: FloatingActionButton(
      onPressed: () => setState(() => _count++),
      child: const Icon(Icons.add),
    ),
  );
}
` },
    { path: "test/widget_test.dart", content: `import 'package:flutter_test/flutter_test.dart';

void main() {
  test('1 + 1 = 2', () { expect(1 + 1, 2); });
}
` },
    { path: "pubspec.yaml", content: `name: my_app
description: A Flutter starter project.
publish_to: 'none'
version: 0.1.0
environment:
  sdk: '>=3.0.0 <4.0.0'
dependencies:
  flutter:
    sdk: flutter
dev_dependencies:
  flutter_test:
    sdk: flutter
flutter:
  uses-material-design: true
  assets:
    - assets/
` },
  ],
};

const javaAndroidApp: MultiTemplate = {
  id: "android-java-app",
  kind: "multi",
  name: "Android · Java App",
  icon: "android",
  description: "Classic Android Java starter with Activity, layout, and assets folder.",
  tracks: ["mobile"],
  language: "java",
  folders: ["src", "res/layout", "res/values", "assets"],
  activePath: "src/MainActivity.java",
  files: [
    { path: "src/MainActivity.java", content: `package com.example.app;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;

public class MainActivity extends Activity {
  private int count = 0;
  private TextView label;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    setContentView(R.layout.activity_main);
    label = findViewById(R.id.label);
    Button btn = findViewById(R.id.btn);
    btn.setOnClickListener(v -> {
      count++;
      label.setText("Taps: " + count);
    });
  }
}
` },
    { path: "res/layout/activity_main.xml", content: `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:orientation="vertical"
  android:layout_width="match_parent"
  android:layout_height="match_parent"
  android:padding="24dp">
  <TextView android:id="@+id/label"
    android:layout_width="wrap_content"
    android:layout_height="wrap_content"
    android:text="Taps: 0"
    android:textSize="20sp" />
  <Button android:id="@+id/btn"
    android:layout_width="wrap_content"
    android:layout_height="wrap_content"
    android:text="Tap me" />
</LinearLayout>
` },
    { path: "res/values/strings.xml", content: `<resources>
  <string name="app_name">MyApp</string>
</resources>
` },
  ],
};

// ---------------------------------------------------------------------------
// Multi-file Web starter (folders + assets)

const webStarter: MultiTemplate = {
  id: "web-multi-starter",
  kind: "multi",
  name: "Web · Multi-page Site",
  icon: "blank-web",
  description: "HTML/CSS/JS site with pages/, styles/, scripts/, and assets/ folders.",
  tracks: ["web"],
  language: "javascript",
  folders: ["pages", "styles", "scripts", "assets"],
  activePath: "index.html",
  files: [
    { path: "index.html", content: `<!doctype html>
<html><head>
  <meta charset="utf-8" />
  <title>My Site</title>
  <link rel="stylesheet" href="styles/main.css" />
</head><body>
  <header><h1>Welcome</h1></header>
  <main>
    <p>Edit <code>index.html</code> or open <a href="pages/about.html">About</a>.</p>
  </main>
  <script src="scripts/app.js"></script>
</body></html>
` },
    { path: "pages/about.html", content: `<!doctype html>
<html><head><meta charset="utf-8"><title>About</title>
<link rel="stylesheet" href="../styles/main.css"></head>
<body><h1>About</h1><p>Multi-page web starter.</p></body></html>
` },
    { path: "styles/main.css", content: `:root { color-scheme: dark; }
body { margin:0; padding:32px; font-family:system-ui,sans-serif;
  background:#0b1020; color:#e8ecff; }
h1 { background:linear-gradient(160deg,#5fd38a,#4f8cff);
  -webkit-background-clip:text; color:transparent; }
a { color:#7eb2ff; }
` },
    { path: "scripts/app.js", content: `console.log('App loaded');
document.querySelector('h1')?.addEventListener('click', () => alert('Hello!'));
` },
    { path: "README.md", content: `# Web Multi-page Starter

Add images / PDFs to the \`assets/\` folder.
` },
  ],
};

export const MULTI_TEMPLATES: MultiTemplate[] = [
  androidKotlin,
  javaAndroidApp,
  iosSwift,
  flutterApp,
  webStarter,
];
