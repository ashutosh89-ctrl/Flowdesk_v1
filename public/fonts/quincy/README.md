# Quincy Font Assets Directory

FlowDesk is configured to use **Quincy / Quincy CF** across the entire SaaS product.

### How Quincy is Loaded:
1. **Local Desktop Fonts**: If Quincy or Quincy CF is installed locally on your operating system, the browser will automatically use it via `local('Quincy CF')` and `local('Quincy')`.
2. **Self-Hosted Webfonts**: Place your Quincy font files into this directory:
   - `QuincyCF-Regular.woff2` (or `.otf` / `.ttf`)
   - `QuincyCF-Medium.woff2`
   - `QuincyCF-DemiBold.woff2`
   - `QuincyCF-Bold.woff2`
   - `QuincyCF-ExtraBold.woff2`
   - `QuincyCF-RegularItalic.woff2`
   - `QuincyCF-BoldItalic.woff2`

3. **Adobe Fonts (Typekit)**: If using Adobe Creative Cloud / Typekit, set your Typekit Project ID in your environment variables:
   `NEXT_PUBLIC_TYPEKIT_ID=your_project_id`
   or link the stylesheet in `app/layout.tsx`.
