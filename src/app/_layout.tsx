import { Stack } from 'expo-router';
import Head from 'expo-router/head';

export default function RootLayout() {
  // 動態版本號，確保每次更新或使用者首次載入時都必定抓取最新的愛心圖示
  const version = 'v=20261011';
  const heartSvg = "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20100%20100'%3E%3Ctext%20y='.9em'%20font-size='90'%3E❤️%3C/text%3E%3C/svg%3E";

  return (
    <>
      <Head>
        <title>{'0917&1224'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {/* 多重宣告 icon 類型，強制覆蓋各種瀏覽器的預設快取 */}
        <link rel="icon" type="image/svg+xml" href={`${heartSvg}#${version}`} />
        <link rel="shortcut icon" href={`${heartSvg}#${version}`} />
        <link rel="apple-touch-icon" href={`${heartSvg}#${version}`} />
      </Head>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
      </Stack>
    </>
  );
}