# Claude Code: Artifact to Next.js Conversion Automation

## Quick Start
Copy and paste this entire prompt into Claude Code (terminal or IDE) with your artifact code.

---

## MASTER CONVERSION PROMPT

```
You are a Next.js + TypeScript expert. I will provide you with a Claude Artifact code 
(HTML, CSS, JavaScript, or React component). Your task is to:

1. **ANALYZE** the artifact:
   - Identify all components, state, side effects, and styling
   - List all dependencies and external libraries
   - Note any direct DOM manipulation or vanilla JS patterns

2. **CONVERT** to production-ready Next.js:
   - Create a complete Next.js project structure
   - Convert to React components with proper TypeScript types
   - Add 'use client' directive where needed
   - Convert all CSS to Tailwind or CSS modules
   - Replace vanilla JS with React hooks
   - Add proper error handling and loading states

3. **STRUCTURE** the files:
   ```
   src/
   ├── app/
   │   ├── layout.tsx
   │   ├── page.tsx
   │   └── globals.css
   ├── components/
   │   ├── [ComponentName].tsx
   │   └── [ComponentName].module.css (if needed)
   ├── hooks/
   │   └── [customHooks].ts
   ├── types/
   │   └── index.ts
   └── lib/
       └── [utilities].ts
   ```

4. **ADD** TypeScript:
   - Define interfaces for all data structures
   - Add proper return types to functions
   - Use type-safe props for all components
   - Add strict tsconfig settings

5. **OPTIMIZE**:
   - Code-split with dynamic imports
   - Add React.memo for expensive components
   - Implement proper dependency arrays in useEffect
   - Use next/image for image optimization

6. **OUTPUT** for each file:
   - Full file path
   - Complete code with explanatory comments
   - TypeScript types clearly defined
   - Tailwind classes for styling

IMPORTANT:
- Do NOT ask questions; assume standard Next.js conventions
- Do NOT create placeholder components; make them fully functional
- Do NOT skip TypeScript types
- Do NOT use inline styles; use Tailwind or CSS modules
- Make sure all code is production-ready and follows best practices

When ready, respond with "I'm ready to convert your artifact. Please paste the artifact code below."
```

---

## HOW TO USE IN CLAUDE CODE

### **Option 1: Terminal (Claude Code CLI)**
```bash
# 1. Create a new Next.js project first
npx create-next-app@latest my-artifact-app --typescript --tailwind

# 2. Open Claude Code in terminal
cd my-artifact-app

# 3. Run the conversion
claude-code << 'EOF'
<PASTE THE MASTER CONVERSION PROMPT HERE>

<PASTE YOUR ARTIFACT CODE HERE>
EOF
```

### **Option 2: VS Code Extension**
1. Open VS Code
2. Press `Cmd/Ctrl + Shift + P`
3. Search "Claude Code: New Agent"
4. Create new agent in the editor
5. Paste the master prompt + your artifact code
6. Claude will generate all files

### **Option 3: JetBrains IDE**
1. Right-click project folder
2. Select "Claude Code" → "New Agent"
3. Paste prompt + artifact code
4. Files will be created in your project

---

## SPECIFIC USE CASES

### **If Your Artifact is a React Component:**
```
[Master Prompt Above]

My artifact is a React component:

<ComponentName /> - [Brief description]

Here is the code:
\`\`\`jsx
[Paste artifact code]
\`\`\`

It uses these libraries: [List any dependencies]
It has these features: [State, API calls, etc.]
```

### **If Your Artifact is HTML/CSS/JS:**
```
[Master Prompt Above]

My artifact is vanilla HTML/CSS/JavaScript.

Here is the code:
\`\`\`html
[Paste artifact code]
\`\`\`

It uses: [Canvas, APIs, DOM manipulation, etc.]
Key functionality: [Describe what it does]
```

### **If Your Artifact Uses External Libraries:**
```
[Master Prompt Above]

My artifact uses:
- React Query for data fetching
- Zustand for state management
- Framer Motion for animations
- Chart.js for visualizations

Here is the code:
\`\`\`jsx
[Paste artifact code]
\`\`\`
```

---

## POST-CONVERSION CHECKLIST

After Claude Code generates your files:

- [ ] Copy all generated files to your Next.js `src/` directory
- [ ] Run `npm install` to add any new dependencies
- [ ] Check `package.json` for required packages
- [ ] Run `npm run dev` and test at `http://localhost:3000`
- [ ] Fix any TypeScript errors: `npm run type-check`
- [ ] Run linter: `npm run lint`
- [ ] Build for production: `npm run build`
- [ ] Deploy to Vercel: `vercel`

---

## ADVANCED: AUTOMATION SCRIPT

Save this as `convert-artifact.sh` and run `bash convert-artifact.sh`:

```bash
#!/bin/bash

# Interactive artifact conversion script
echo "🚀 Claude Artifact → Next.js Converter"
echo "========================================"

# Step 1: Get project name
read -p "Project name: " PROJECT_NAME

# Step 2: Create Next.js project
echo "📦 Creating Next.js project..."
npx create-next-app@latest "$PROJECT_NAME" \
  --typescript \
  --tailwind \
  --eslint \
  --src-dir \
  --no-git

cd "$PROJECT_NAME"

# Step 3: Prepare for Claude Code
echo ""
echo "📋 Ready to convert!"
echo ""
echo "Next steps:"
echo "1. Paste this conversion prompt into Claude Code (terminal or IDE):"
echo ""
cat << 'EOF'
<PASTE MASTER PROMPT HERE>
EOF

echo ""
echo "2. When prompted, paste your artifact code"
echo "3. Claude will generate all necessary files"
echo "4. Run: npm run dev"
echo ""
echo "✨ Done!"
```

---

## EXAMPLE OUTPUT

Here's what Claude Code will typically generate:

**src/app/page.tsx**
```typescript
'use client';
import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import MainContent from '@/components/MainContent';

export default function Home() {
  const [data, setData] = useState<DataType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Your data fetching logic
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Header />
      {loading ? <div>Loading...</div> : <MainContent data={data} />}
    </main>
  );
}
```

**src/components/Header.tsx**
```typescript
interface HeaderProps {
  title?: string;
}

export default function Header({ title = 'My App' }: HeaderProps) {
  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
      </div>
    </header>
  );
}
```

**src/types/index.ts**
```typescript
export interface DataType {
  id: number;
  name: string;
  description?: string;
}

export interface ApiResponse<T> {
  data: T[];
  status: 'success' | 'error';
  message?: string;
}
```

---

## TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| Claude Code not installed | Run: `npm install -g @anthropic-ai/sdk` or install extension |
| Files not created in right place | Copy manually to `src/app` and `src/components` |
| TypeScript errors after generation | Run `npm run type-check` and add missing types |
| Dependencies missing | Check generated file comments and run `npm install` |
| Styling not applied | Ensure Tailwind is enabled in `tailwind.config.ts` |

---

## NEXT STEPS AFTER CONVERSION

1. **Add API Routes** (if needed):
   ```typescript
   // src/app/api/route.ts
   export async function GET(request: Request) {
     return Response.json({ data: [] });
   }
   ```

2. **Add Environment Variables**:
   ```env
   # .env.local
   NEXT_PUBLIC_API_URL=http://localhost:3000
   ```

3. **Deploy**:
   ```bash
   npm install -g vercel
   vercel
   ```

4. **Monitor**:
   ```bash
   npm run build  # Check for errors
   npm run lint   # Fix code quality
   ```

---

**Happy converting! 🎉**
