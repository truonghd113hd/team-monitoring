# Invo Admin Dashboard

A modern admin dashboard built with Next.js 14, TypeScript, and Tailwind CSS.

## Features

- **Dark/Light Mode**: Toggle between themes with next-themes
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Component Library**: Reusable UI components (Button, Card, Input)
- **App Router**: Using Next.js 14 App Router for routing
- **TypeScript**: Full type safety throughout the application

## Project Structure

```
invo-admin/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (dashboard)/        # Group layout dashboard
│   │   │   ├── layout.tsx      # Layout chung (Sidebar + Header)
│   │   │   ├── page.tsx        # Trang Tổng quan (Home)
│   │   │   ├── issues/         # Trang Quản lý Issue
│   │   │   │   └── page.tsx
│   │   │   └── notifications/  # Trang Thông báo
│   │   │       └── page.tsx
│   │   └── layout.tsx          # Root layout (Font, Theme provider)
│   ├── components/             # Các thành phần UI tái sử dụng
│   │   ├── sidebar.tsx
│   │   ├── header.tsx
│   │   ├── mode-toggle.tsx
│   │   ├── theme-provider.tsx
│   │   ├── ui/                 # Base components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   └── input.tsx
│   │   └── charts/             # Biểu đồ sức khỏe (placeholder)
│   └── lib/                    # Utils, Constants, Types
│       └── utils.ts
├── public/                     # Assets (Logo, Images)
├── tailwind.config.ts
├── tsconfig.json
├── next.config.js
├── postcss.config.js
└── package.json
```

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Build for Production

```bash
npm run build
npm start
```

## Docker

### Build image

```bash
docker build -t invo-admin-frontend .
```

### Run container (standalone)

```bash
docker run -d \
  --name invo-frontend \
  -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=http://localhost:5000/api \
  invo-admin-frontend
```

### Run with docker-compose (recommended)

From the root of the monorepo:

```bash
docker compose up -d
```

## Technologies Used

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS framework
- **next-themes** - Theme management
- **Lucide React** - Icon library
- **class-variance-authority** - Component variant management

## Components

### Theme Provider
Manages dark/light mode state across the application.

### Mode Toggle
Button to switch between dark and light themes.

### Sidebar
Navigation sidebar with menu items and system status.

### Header
Top navigation bar with search and theme toggle.

### UI Components
- Button: Customizable button component
- Card: Card container component
- Input: Form input component

## Pages

- **/**: Dashboard overview with statistics cards
- **/issues**: Issue management page
- **/notifications**: Notifications page