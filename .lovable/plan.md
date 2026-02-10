

## Add 101Kerja Logo to Login Screen and Admin Portal

### Overview
Copy the uploaded logo image into the project and replace the current icon/text placeholders on both the login page and the sidebar header with the actual logo.

### Changes

#### 1. Copy the logo file
Copy `user-uploads://101kerja-21-2-removebg-preview.jpg` to `src/assets/101kerja-logo.jpg`.

#### 2. Update Login Page (`src/pages/Login.tsx`)
- Import the logo: `import logo from "@/assets/101kerja-logo.jpg"`
- Replace the blue square with the Briefcase icon (lines 43-45) with an `<img>` tag displaying the logo (approximately 56x56px or similar).

#### 3. Update Sidebar Header (`src/components/DashboardLayout.tsx`)
- Import the logo: `import logo from "@/assets/101kerja-logo.jpg"`
- Replace the blue "101" square (lines 98-100) with an `<img>` tag displaying the logo (32x32px, rounded corners to match current style).

### Technical Details
- The logo is imported as an ES module from `src/assets/` for proper Vite bundling and optimization.
- The `<img>` tags will use `object-contain` to preserve aspect ratio.
- No other files are affected.

