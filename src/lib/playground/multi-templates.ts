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

// ---------------------------------------------------------------------------
// Networked starters: each ships an ApiService + Repository layer wired to a
// public placeholder API so devs can study a clean architecture without setup.

const androidKotlinApi: MultiTemplate = {
  id: "android-kotlin-api",
  kind: "multi",
  name: "Android · Kotlin + API",
  icon: "android",
  description: "Kotlin/Compose app with Retrofit ApiService + Repository layer.",
  tracks: ["mobile"],
  language: "kotlin",
  folders: ["src", "src/data", "src/data/remote", "src/data/repository", "src/ui", "assets"],
  activePath: "src/ui/PostsScreen.kt",
  files: [
    { path: "src/data/remote/ApiService.kt", content: `package com.example.app.data.remote

import retrofit2.http.GET
import retrofit2.http.Path

data class Post(val id: Int, val title: String, val body: String)

interface ApiService {
  @GET("posts") suspend fun listPosts(): List<Post>
  @GET("posts/{id}") suspend fun getPost(@Path("id") id: Int): Post
}
` },
    { path: "src/data/remote/RetrofitClient.kt", content: `package com.example.app.data.remote

import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

object RetrofitClient {
  val api: ApiService by lazy {
    Retrofit.Builder()
      .baseUrl("https://jsonplaceholder.typicode.com/")
      .addConverterFactory(MoshiConverterFactory.create())
      .build()
      .create(ApiService::class.java)
  }
}
` },
    { path: "src/data/repository/PostsRepository.kt", content: `package com.example.app.data.repository

import com.example.app.data.remote.Post
import com.example.app.data.remote.RetrofitClient

class PostsRepository(private val api: com.example.app.data.remote.ApiService = RetrofitClient.api) {
  suspend fun all(): List<Post> = api.listPosts()
  suspend fun one(id: Int): Post = api.getPost(id)
}
` },
    { path: "src/ui/PostsScreen.kt", content: `package com.example.app.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.app.data.remote.Post
import com.example.app.data.repository.PostsRepository
import kotlinx.coroutines.launch

@Composable
fun PostsScreen(repo: PostsRepository = PostsRepository()) {
  var posts by remember { mutableStateOf<List<Post>>(emptyList()) }
  val scope = rememberCoroutineScope()
  LaunchedEffect(Unit) { scope.launch { posts = repo.all() } }
  LazyColumn(Modifier.padding(16.dp)) {
    items(posts) { p ->
      ListItem(headlineContent = { Text(p.title) }, supportingContent = { Text(p.body) })
      Divider()
    }
  }
}
` },
    { path: "README.md", content: `# Android Kotlin + API Starter

Architecture: Compose UI → Repository → ApiService (Retrofit + Moshi).
Replace the base URL in \`RetrofitClient.kt\` and add your own endpoints
to \`ApiService.kt\`. The Repository layer keeps UI code free of network details.
` },
  ],
};

const iosSwiftApi: MultiTemplate = {
  id: "ios-swift-api",
  kind: "multi",
  name: "iOS · Swift + API",
  icon: "swift",
  description: "SwiftUI app with URLSession ApiService + Repository layer.",
  tracks: ["mobile"],
  language: "swift",
  folders: ["Sources", "Sources/Data", "Sources/Data/Remote", "Sources/Data/Repository", "Sources/Views", "assets"],
  activePath: "Sources/Views/PostsView.swift",
  files: [
    { path: "Sources/Data/Remote/ApiService.swift", content: `import Foundation

struct Post: Codable, Identifiable {
  let id: Int; let title: String; let body: String
}

protocol ApiService {
  func listPosts() async throws -> [Post]
  func post(id: Int) async throws -> Post
}

final class HttpApiService: ApiService {
  private let base = URL(string: "https://jsonplaceholder.typicode.com")!
  func listPosts() async throws -> [Post] {
    let (data, _) = try await URLSession.shared.data(from: base.appendingPathComponent("posts"))
    return try JSONDecoder().decode([Post].self, from: data)
  }
  func post(id: Int) async throws -> Post {
    let (data, _) = try await URLSession.shared.data(from: base.appendingPathComponent("posts/\\(id)"))
    return try JSONDecoder().decode(Post.self, from: data)
  }
}
` },
    { path: "Sources/Data/Repository/PostsRepository.swift", content: `import Foundation

final class PostsRepository {
  private let api: ApiService
  init(api: ApiService = HttpApiService()) { self.api = api }
  func all() async throws -> [Post] { try await api.listPosts() }
  func one(_ id: Int) async throws -> Post { try await api.post(id: id) }
}
` },
    { path: "Sources/Views/PostsView.swift", content: `import SwiftUI

struct PostsView: View {
  @State private var posts: [Post] = []
  private let repo = PostsRepository()
  var body: some View {
    List(posts) { p in
      VStack(alignment: .leading) {
        Text(p.title).font(.headline)
        Text(p.body).font(.subheadline).foregroundColor(.secondary)
      }
    }
    .task { posts = (try? await repo.all()) ?? [] }
  }
}
` },
    { path: "README.md", content: `# iOS Swift + API Starter

Architecture: SwiftUI View → Repository → ApiService (URLSession).
Swap \`HttpApiService\` for a mock in previews/tests by conforming to \`ApiService\`.
` },
  ],
};

const flutterApi: MultiTemplate = {
  id: "flutter-api",
  kind: "multi",
  name: "Flutter · Dart + API",
  icon: "flutter",
  description: "Flutter app with http ApiService + Repository layer.",
  tracks: ["mobile"],
  language: "dart",
  folders: ["lib", "lib/data", "lib/data/remote", "lib/data/repository", "lib/screens", "assets"],
  activePath: "lib/screens/posts_screen.dart",
  files: [
    { path: "lib/data/remote/api_service.dart", content: `import 'dart:convert';
import 'package:http/http.dart' as http;

class Post {
  final int id; final String title; final String body;
  Post(this.id, this.title, this.body);
  factory Post.fromJson(Map<String, dynamic> j) => Post(j['id'], j['title'], j['body']);
}

class ApiService {
  static const _base = 'https://jsonplaceholder.typicode.com';
  Future<List<Post>> listPosts() async {
    final r = await http.get(Uri.parse('\$_base/posts'));
    return (jsonDecode(r.body) as List).map((j) => Post.fromJson(j)).toList();
  }
  Future<Post> getPost(int id) async {
    final r = await http.get(Uri.parse('\$_base/posts/\$id'));
    return Post.fromJson(jsonDecode(r.body));
  }
}
` },
    { path: "lib/data/repository/posts_repository.dart", content: `import '../remote/api_service.dart';

class PostsRepository {
  final ApiService api;
  PostsRepository({ApiService? api}) : api = api ?? ApiService();
  Future<List<Post>> all() => api.listPosts();
  Future<Post> one(int id) => api.getPost(id);
}
` },
    { path: "lib/screens/posts_screen.dart", content: `import 'package:flutter/material.dart';
import '../data/repository/posts_repository.dart';
import '../data/remote/api_service.dart';

class PostsScreen extends StatefulWidget {
  const PostsScreen({super.key});
  @override State<PostsScreen> createState() => _PostsScreenState();
}

class _PostsScreenState extends State<PostsScreen> {
  final repo = PostsRepository();
  List<Post> posts = [];
  @override void initState() { super.initState(); repo.all().then((p) => setState(() => posts = p)); }
  @override Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Posts')),
    body: ListView.separated(
      itemCount: posts.length,
      separatorBuilder: (_, __) => const Divider(),
      itemBuilder: (_, i) => ListTile(title: Text(posts[i].title), subtitle: Text(posts[i].body)),
    ),
  );
}
` },
    { path: "README.md", content: `# Flutter + API Starter

Architecture: Widget → Repository → ApiService (package:http).
Add \`http: ^1.0.0\` to pubspec dependencies.
` },
  ],
};

export const MULTI_TEMPLATES: MultiTemplate[] = [
  androidKotlin,
  javaAndroidApp,
  iosSwift,
  flutterApp,
  webStarter,
  androidKotlinApi,
  iosSwiftApi,
  flutterApi,
];
