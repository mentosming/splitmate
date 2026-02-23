# 🤖 AI_README - Splitmate (Debtcollet) 專案上下文紀錄

這個檔案作為 AI 助手（例如 Gemini/Antigravity）在全新電腦上開啟此專案時的持續上下文文件。這可以防止 AI 每次都需要從頭開始重新學習專案結構。

## 🎯 專案概述
**名稱**: Splitmate (在 package.json 內的內部名稱: `debtcollet`)
**類型**: 前端網頁應用程式 (React App)
**用途**: 一個基於團隊的費用分攤和債務收集應用程式，使用者可以在團隊成員之間追蹤共享費用、結餘和還款情況。

## 🛠️ 技術堆疊
- **框架**: React 19 + Vite
- **路由**: React Router (`react-router-dom` v7)
- **樣式**: Tailwind CSS v4 + `clsx` + `tailwind-merge`
- **圖示**: Lucide React
- **後端 / BaaS (後端即服務)**: Supabase (`@supabase/supabase-js`)
  - 身份驗證 (Email/密碼 或 OAuth)
  - Postgres 資料庫 (具備 RLS 列級安全策略)
  - 即時訂閱 (透過 Supabase Channels)

## 📁 專案結構 (`src/`)
- `App.jsx`: 主要進入點，處理路由和受保護的路由 (`ProtectedRoute`)。還有給超級管理員的 `/admin` 路由。
- `components/`: 使用者介面元件 (例如 `Layout.jsx` 作為主要外殼，包含只有管理員可見的後台入口)。
- `contexts/`: React Context 提供者。
  - `AuthContext.jsx`: 身份驗證的核心狀態，追蹤 `currentUser`、`currentTeam` 以及 `team_members` 的即時更新。
- `lib/`: 實用工具函數與客戶端。
  - `supabase.js`: Supabase 客戶端初始化。
  - `utils.js`: 輔助函數 (例如用於合併 class 的 `cn`)。
- `pages/`: 用於路由的頁面元件：
  - `AdminDashboard.jsx`: [NEW] 絕對後台，只有 `ming1988@gmail.com` 可以存取，用於跨團隊管理所有資料。
  - `Login.jsx`: 使用者登入/註冊。
  - `TeamSetup.jsx`: 允許使用者在登入後建立或加入團隊。
  - `Dashboard.jsx`: 主要儀表板，顯示參與者的結餘、近期交易紀錄，並支援按月份篩選與 CSV 匯出功能。
  - `AddTransaction.jsx`: 建立新支出並進行分帳的表單。
  - `Repayment.jsx`: 用於結算參與者之間債務的介面。
  - `Settings.jsx`: 團隊管理、新增參與者、分享邀請連結。

## 🗄️ 資料庫模型 (Supabase)
基於應用程式邏輯，資料庫結構假設包含以下核心資料表：
1. **`teams`**: `id`, `name`, `admin_id`, `created_at`
2. **`team_members`**: 連結 Supabase auth 使用者與團隊的表 (`team_id`, `user_id`, `status: pending/member/admin`)。
3. **`participants`**: 參與費用的成員 (`id`, `team_id`, `name`, `avatar_url`)。注意：這些不一定是經過身份驗證的使用者，而是團隊內的邏輯成員。
4. **`transactions`**: 支出明細 (`id`, `team_id`, `payer_id`, `total_amount`, `title`, `date`, `receipt_url`, `created_at`)。
5. **`transaction_splits`**: 該筆交易如何被分攤 (`id`, `transaction_id`, `participant_id`, `amount`)。

## 🔑 核心機制
- **絕對後台管理**: `ming1988@gmail.com` 在前端擁有特規的 `/admin` 頁面，可以直接存取 `teams`、`transactions` 表。(需配合 Supabase SQL Policy: `auth.jwt() ->> 'email' = 'ming1988@gmail.com'`)
- **即時更新**: 像 `Dashboard.jsx` 和 `AuthContext.jsx` 這樣的頁面會主動訂閱 Supabase Postgres 的變更 (`postgres_changes`)，以即時反映新的交易、分帳和團隊成員更新。
- **團隊隔離**: 幾乎所有的查詢和訂閱都會透過 `team_id` 進行過濾，確保使用者只能看到他們目前處於活動狀態的團隊資料。
- **計算結餘**: 結餘由前端動態計算。透過迭代所選月份/整體的所有的 `transactions` (交易) 與 `transaction_splits` (分帳)。付款人獲得正數結餘 (+)，而參與分帳的人則扣除相應結餘 (-)。

## 🚀 執行專案
1. `npm install`
2. `npm run dev` (如果要讓區域網路的手機連上以測試 PWA，請在 package.json 使用 `--host` 參數)
*(需要有包含 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY` 的 `.env` 或 `.env.local` 檔案)*

## 📱 PWA (漸進式網頁應用程式)
專案已整合 `vite-plugin-pwa`。
- 提供自訂的 `PWAPrompt` 元件 (透過 `usePWA` hook)，當瀏覽器觸發 `beforeinstallprompt` 事件時，於畫面底部顯示安裝提示。針對 iOS Safari，則提供手動分享加入主畫面的指示。
- 測試時建議使用 `npm run dev --host` 讓同網段裝置連線。

---
*給 AI 助手：當繼續進行此專案的工作時，請使用本文件作為您的主要上下文，在進行修改前了解架構和領域模型。*
