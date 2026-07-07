# VOLLEYSHOOT CHALLENGE — React Native ネイティブアプリ

Web版(volleyshoot-game.html)の全ロジックをTypeScript/React Nativeに移植した、
iPhone/Android両対応の本格ネイティブアプリです。骨格検出は端末内蔵のAI(MoveNet/TFLite)で行われ、
映像は外部に一切送信されません。

## 実装状況(正直な現状)

| 項目 | 状態 |
|---|---|
| ゲームロジック(物理・判定・スコア・ランク) | ✅ 完全移植・**34件のユニットテスト全パス** |
| ゴールターゲットのシュート方向モデル | ✅ 完全移植・テスト済み |
| スコア履歴・ハイスコア・連続日数(AsyncStorage) | ✅ 実装済み |
| UI画面(モード選択・難易度選択・結果画面) | ✅ 実装済み(Web版v12のダークテーマを再現) |
| カメラ+MoveNet骨格検出 | ✅ 正しいAPIで実装済み。**実機での動作確認は未実施**(このビルド環境にカメラ・実機がないため) |
| iOS/Androidの実ビルド | ❌ 未実施。Xcode(Mac必須)・Android Studioでの手元ビルドが必要 |
| ストア提出 | ❌ 未実施。Apple Developer Program / Google Play Consoleのアカウントでの申請が必要 |

## ディレクトリ構成

```
app/                     Expo Routerの画面(index, difficulty, game, result)
src/game/                ゲームロジック(純粋関数・フレームワーク非依存)
  constants.ts           難易度・ボール種別などの定数
  types.ts               型定義
  physics.ts             ボール生成・放物線運動
  kickDetection.ts       タッチ/キック/PERFECT判定、黒ボール判定、スコア計算
  goalTarget.ts          ゴールターゲットのシュート方向・ゴール判定
src/hooks/
  usePoseDetection.ts    vision-camera + fast-tflite によるMoveNet骨格検出
  useGameEngine.ts        ゲームループ(spawn→物理→判定→スコア反映)
src/storage/
  gameStorage.ts         AsyncStorageベースのスコア履歴・ハイスコア・ストリーク
__tests__/
  gameLogic.test.ts      34件のユニットテスト(vitest)
assets/models/           MoveNet Lightning TFLiteモデル(2.8MB, 端末内蔵)
```

## セットアップ(あなたの手元で行う作業)

### 1. 依存関係のインストール

```bash
npm install
```

### 2. ロジックのテストを実行(動作確認)

```bash
npm test
```

34件のテストが通ることを確認してください。これはこのプロジェクトの心臓部(物理演算・キック判定・スコア計算・シュート方向)が正しく動作する保証です。

### 3. Development Buildの作成

**重要**: このアプリは`react-native-vision-camera`と`react-native-fast-tflite`を使うため、
**Expo Goでは動きません**。Development Buildが必須です。

```bash
npx expo prebuild
```

これで `ios/` と `android/` フォルダが生成されます。

### 4-A. iOSビルド(Macが必須)

```bash
npx expo run:ios
```

または生成された `ios/*.xcworkspace` をXcodeで開いて実機ビルド。

**App Store提出に必要なもの**:
- Apple Developer Program登録(年間$99)
- Xcodeでのアーカイブ・署名
- App Store Connectでのアプリ情報登録・審査提出
- カメラ使用理由の説明文は `app.json` に設定済み

### 4-B. Androidビルド

```bash
npx expo run:android
```

**Google Play提出に必要なもの**:
- Google Play Consoleアカウント登録(初回$25)
- `eas build --platform android` でのAAB生成、または上記コマンドで生成されたプロジェクトをAndroid StudioでSigned Bundle作成
- ターゲットSDK 35以上(2025年時点の必須要件)への追従

### 5. EAS Build(クラウドビルド・Mac不要の代替案)

Macを持っていない場合、Expoのクラウドビルドサービスを使えばMac無しでiOSビルドも可能です。

```bash
npm install -g eas-cli
eas login
eas build --platform ios
eas build --platform android
```

ビルドが完了するとダウンロードリンクが発行されます。ストア提出は別途 `eas submit` で行えます。
(Expoアカウントとの契約・料金体系は https://expo.dev/pricing で確認してください)

## 既知の制約・今後の検証ポイント

1. **カメラ実機テストが未実施**: `usePoseDetection.ts` はvision-camera + fast-tflite公式APIに沿って実装していますが、実機でのフレームレート・検出精度は未検証です。まず実機ビルドして骨格検出の感度を確認してください。
2. **足のみ検出(MoveNet)**: Web版はMediaPipeの33点(つま先・かかと含む)でしたが、MoveNetは17点(足首まで)です。`hitRadius`に1.2倍の補正を入れていますが、実機で判定の広さが合わなければ `src/game/constants.ts` の `hitRadius` を調整してください。
3. **正面ボールの奥行き表現**: 骨格のZ座標(奥行き)はMoveNetでは取得できないため、Web版と同じく画面上のY座標変化で疑似的に表現しています。
4. **タッチ部位分類(インステップ/インサイド等)は非搭載**: Web版でも精度限界により表示を廃止した経緯があり、本移植でも含めていません。
5. **音・振動**: `expo-haptics`は組み込み済みですが、効果音(Web版はWeb Audio合成)は未移植です。`expo-av`等での追加が必要です。
6. **リプレイ録画機能**: Web版にあった「1プレイ丸ごと録画」機能は本移植には含まれていません。ネイティブでは `react-native-vision-camera` の録画API(`camera.startRecording()`)で実現可能です。

## 収益化(将来の拡張)

- 広告: `react-native-google-mobile-ads` (AdMob)
- 課金: `react-native-iap` (広告なし版・エキスパート難易度など)

詳細は同梱不要ですが、既存の `NATIVE_MIGRATION.md`(別途お渡し済み)の収益化セクションを参照してください。
