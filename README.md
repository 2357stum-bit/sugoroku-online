# マネー双六 オンライン

友達とルームを作って、リアルタイムで100マスの人生ゲーム風すごろくを遊べるWebアプリです。

## セットアップ

1. Firebaseプロジェクトを用意する
   - Authentication → Sign-in method → 匿名(Anonymous)ログインを有効化
   - Firestore Database を作成
   - Firestoreの「ルール」タブに `firestore.rules.txt` の内容を貼り付けて公開
2. `.env.local.example` を `.env.local` にコピーし、Firebaseの設定値を入力
3. 依存パッケージをインストールして起動

```bash
npm install
npm run dev
```

## デプロイ

Vercelなどにデプロイする場合、`.env.local` と同じ内容の環境変数をホスティング側の設定に追加してください。
