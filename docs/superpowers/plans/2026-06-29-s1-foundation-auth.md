# S1: Foundation + Auth + Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the React + Vite project with Supabase auth, RBAC context, app shell (Topbar + Sidebar), Command Palette, Toast system, and dark mode — the foundation all other sub-projects build on.

**Architecture:** Vite + React 18 + TypeScript app with React Router v6 for routing, Supabase JS v2 for auth and data, shadcn/ui + Tailwind CSS for UI, Zustand for client state. Shell layout wraps all `/app/*` routes. Auth state and RBAC permissions exposed via React context.

**Tech Stack:** React 18, Vite 5, TypeScript 5 (strict), React Router v6, Tailwind CSS 3, shadcn/ui, Supabase JS v2, Zustand v4, Framer Motion v11, Lucide React, cmdk

## Global Constraints

- Node.js ≥ 18 required
- Project root: `c:\Users\datan\OneDrive\Desktop\New Devolution` — scaffold Vite **in-place** (no subfolder)
- TypeScript strict mode: `"strict": true` in tsconfig
- Primary: `#2563EB` · Positive: `#059669` · Danger: `#DC2626` · Warning: `#D97706` · BG: `#F8FAFC` · Surface: `#FFFFFF`
- Fonts: Poppins (400/600/700) for headings, Open Sans (400/500) for body — loaded via Google Fonts in `index.html`
- Dark mode via `dark` class on `<html>`, persisted in `localStorage('cdv_dark_mode')`
- Supabase client singleton in `src/lib/supabase.ts`; env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- All `/app/*` routes require authenticated session + at least one module permission
- No CSS-in-JS — Tailwind + CSS custom properties only
- Package manager: npm

---

## File Structure

```
(project root)
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tailwind.config.ts
├── postcss.config.js
├── components.json              ← shadcn/ui config
├── .env.local                   ← VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
├── src/
│   ├── main.tsx
│   ├── App.tsx                  ← Router root
│   ├── index.css                ← Tailwind directives + CSS variables
│   ├── lib/
│   │   └── supabase.ts          ← Supabase client singleton
│   ├── types/
│   │   └── database.ts          ← TypeScript types for all DB tables
│   ├── contexts/
│   │   ├── AuthContext.tsx       ← Session + user profile
│   │   └── RBACContext.tsx       ← Cargo + modulos + isAdmin
│   ├── stores/
│   │   └── uiStore.ts           ← Dark mode, command palette open state
│   ├── hooks/
│   │   └── usePermission.ts     ← hasModule(mod) helper
│   ├── components/
│   │   ├── ui/                  ← shadcn/ui generated components
│   │   ├── Shell/
│   │   │   ├── Shell.tsx        ← Layout wrapper (Topbar + Sidebar + Outlet)
│   │   │   ├── Topbar.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── BottomNav.tsx    ← Mobile bottom nav (5 items)
│   │   ├── CommandPalette.tsx   ← Ctrl+K cmdk dialog
│   │   ├── Toast.tsx            ← Global toast (ok/err/warn/info)
│   │   └── UndoBar.tsx          ← Slide-up undo bar (15s)
│   └── pages/
│       ├── LoginPage.tsx
│       ├── AccessDeniedPage.tsx
│       └── HomePage.tsx         ← Hub: KPIs + Quick Notes placeholder
```

---

### Task 1: Scaffold Project + Install Dependencies

**Files:**
- Create: `index.html`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `package.json`

**Interfaces:**
- Produces: working `npm run dev` and `npm run build`

- [ ] **Step 1: Initialize Vite project in-place**

```bash
npm create vite@latest . -- --template react-ts
```

When prompted "Current directory is not empty. Remove existing files and continue?", type `y` (only removes generated files, not DOCUMENTACAO.md or docs/).

- [ ] **Step 2: Install all dependencies**

```bash
npm install @supabase/supabase-js@^2 react-router-dom@^6 zustand@^4 framer-motion@^11 lucide-react cmdk @tanstack/react-query@^5
npm install -D tailwindcss@^3 postcss autoprefixer @tailwindcss/forms
```

- [ ] **Step 3: Initialize Tailwind**

```bash
npx tailwindcss init -p --ts
```

- [ ] **Step 4: Replace `tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#2563EB', hover: '#1D4ED8' },
        positive: { DEFAULT: '#059669', hover: '#047857' },
        danger: { DEFAULT: '#DC2626', hover: '#B91C1C' },
        warning: { DEFAULT: '#D97706', hover: '#B45309' },
        surface: '#FFFFFF',
      },
      backgroundColor: {
        app: '#F8FAFC',
        'app-dark': '#0F172A',
        'surface-dark': '#1E293B',
      },
      fontFamily: {
        heading: ['Poppins', 'sans-serif'],
        body: ['Open Sans', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
        'soft-lg': '0 4px 16px rgba(0,0,0,0.12)',
      },
      borderRadius: {
        card: '12px',
        btn: '8px',
        badge: '6px',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
} satisfies Config
```

- [ ] **Step 5: Replace `src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=Open+Sans:wght@400;500&display=swap');

:root {
  --primary: #2563EB;
  --positive: #059669;
  --danger: #DC2626;
  --warning: #D97706;
  --bg: #F8FAFC;
  --surface: #FFFFFF;
  --text: #0F172A;
  --text-muted: #64748B;
  --border: #E2E8F0;
  --dur-base: 200ms;
}

html.dark {
  --bg: #0F172A;
  --surface: #1E293B;
  --text: #F1F5F9;
  --text-muted: #94A3B8;
  --border: #334155;
}

body {
  font-family: 'Open Sans', sans-serif;
  background-color: var(--bg);
  color: var(--text);
  transition: background-color var(--dur-base) ease, color var(--dur-base) ease;
}

h1, h2, h3, h4, h5, h6 {
  font-family: 'Poppins', sans-serif;
}
```

- [ ] **Step 6: Update `index.html` title**

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Controle de Devoluções</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Verify dev server starts**

```bash
npm run dev
```

Expected: Server running at `http://localhost:5173` with default Vite page.

- [ ] **Step 8: Commit**

```bash
git init
git add -A
git commit -m "feat: scaffold Vite + React + TS + Tailwind project"
```

---

### Task 2: shadcn/ui Setup + Base Components

**Files:**
- Create: `components.json`, `src/components/ui/` (generated), `src/lib/utils.ts`

**Interfaces:**
- Produces: `cn()` utility, Button, Badge, Dialog, Dropdown, Input, Label, Separator, Sheet, Tabs components from shadcn/ui

- [ ] **Step 1: Initialize shadcn/ui**

```bash
npx shadcn@latest init
```

When prompted:
- Style: Default
- Base color: Slate
- CSS variables: Yes

- [ ] **Step 2: Add required components**

```bash
npx shadcn@latest add button badge dialog dropdown-menu input label separator sheet tabs command tooltip
```

- [ ] **Step 3: Verify `src/lib/utils.ts` exists with `cn` helper**

Expected content (auto-generated):
```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 4: Install missing peer deps if needed**

```bash
npm install clsx tailwind-merge class-variance-authority
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add shadcn/ui with base components"
```

---

### Task 3: TypeScript Database Types + Supabase Client

**Files:**
- Create: `src/types/database.ts`, `src/lib/supabase.ts`, `.env.local`

**Interfaces:**
- Produces: `supabase` client, `Database`, `Profile`, `Cargo`, `NotaFiscal`, `Transferencia`, `Modulo`, `SupabaseStatus`, `SupabaseAba` types

- [ ] **Step 1: Create `.env.local`**

```
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

(Replace with real values from Supabase project settings → API)

- [ ] **Step 2: Create `src/types/database.ts`**

```typescript
export type SupabaseStatus = 'Pendente' | 'Em Transferência' | 'Devolvido' | 'Cancelado' | 'Vendido'
export type SupabaseAba = 'Britania' | 'Unilever' | 'Variados'
export type Modulo =
  | 'notas'
  | 'lancamento'
  | 'email'
  | 'transferencias'
  | 'relatorios'
  | 'auditoria'
  | 'backup'
  | 'configuracoes'
  | 'dashboard'

export type FreteTipo = 'Tabela' | 'Valor+ICMS' | 'Valor' | 'Cortesia'

export interface Profile {
  id: string
  email: string
  nome: string | null
  avatar_url: string | null
  created_at: string
}

export interface Cargo {
  id: string
  nome: string
  created_at: string
}

export interface CargoModulo {
  cargo_id: string
  modulo: Modulo
}

export interface UsuarioCargo {
  user_id: string
  cargo_id: string
  atribuido_por: string | null
  created_at: string
}

export interface NotaFiscal {
  id: string
  nfd: string
  nf: string
  data: string
  fornecedor: string
  aba: SupabaseAba
  tipo: string | null
  motivo: string | null
  descricao: string | null
  qtd: number
  valor_unitario: number
  valor_total: number
  status: SupabaseStatus
  obs: string | null
  responsavel_id: string | null
  frete_tipo: FreteTipo | null
  frete_valor: number | null
  dias_armazem: number
  anexo_url: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Transferencia {
  id: string
  nota_fiscal_id: string
  nfd: string
  nf: string
  tipo: string | null
  caixas: number | null
  valor: number | null
  num_pedido: string | null
  agendamento: string | null
  status: 'Ativa' | 'Concluída' | 'Cancelada'
  created_at: string
}

export interface FotoNF {
  id: string
  nota_fiscal_id: string
  url: string
  r2_key: string
  nome: string | null
  ordem: number
  created_at: string
}

export interface Comentario {
  id: string
  nota_fiscal_id: string
  user_id: string
  texto: string
  created_at: string
}

export interface AuditLog {
  id: string
  user_id: string | null
  acao: string
  tabela: string | null
  registro_id: string | null
  dados_antes: Record<string, unknown> | null
  dados_depois: Record<string, unknown> | null
  created_at: string
}

export interface Config {
  chave: string
  valor: unknown
  updated_at: string
  updated_by: string | null
}

export interface Backup {
  id: string
  nome: string
  tamanho_bytes: number | null
  r2_key: string
  created_by: string | null
  created_at: string
}
```

- [ ] **Step 3: Create `src/lib/supabase.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env vars: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add DB types and Supabase client"
```

---

### Task 4: Auth Context + Login Page

**Files:**
- Create: `src/contexts/AuthContext.tsx`, `src/pages/LoginPage.tsx`

**Interfaces:**
- Produces: `AuthContext` with `{ user, session, profile, loading, signIn, signOut }`
- `signIn(email, password): Promise<{ error: string | null }>`
- `signOut(): Promise<void>`

- [ ] **Step 1: Create `src/contexts/AuthContext.tsx`**

```typescript
import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
    setLoading(false)
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
```

- [ ] **Step 2: Create `src/pages/LoginPage.tsx`**

```typescript
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) { setError(error); return }
    navigate('/app/home')
  }

  return (
    <div className="min-h-screen bg-app dark:bg-app-dark flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-surface dark:bg-surface-dark rounded-card shadow-soft p-8">
        <h1 className="font-heading text-2xl font-bold text-[var(--text)] mb-2">
          Controle de Devoluções
        </h1>
        <p className="text-[var(--text-muted)] text-sm mb-6">Faça login para continuar</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="seu@email.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
          {error && (
            <p className="text-sm text-danger bg-danger/10 rounded-btn px-3 py-2">{error}</p>
          )}
          <Button type="submit" className="w-full bg-primary hover:bg-primary-hover" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add auth context and login page"
```

---

### Task 5: RBAC Context + Route Guards

**Files:**
- Create: `src/contexts/RBACContext.tsx`, `src/hooks/usePermission.ts`, `src/pages/AccessDeniedPage.tsx`
- Create: `src/components/RequireAuth.tsx`, `src/components/RequireModule.tsx`

**Interfaces:**
- Produces: `RBACContext` with `{ cargo, modulos, isAdmin, loadingRBAC }`
- `hasModule(mod: Modulo): boolean`
- `<RequireAuth>` — redirects to `/login` if no session
- `<RequireModule mod="notas">` — redirects to `/acesso-negado` if module not permitted

- [ ] **Step 1: Create `src/contexts/RBACContext.tsx`**

```typescript
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Modulo } from '@/types/database'

interface RBACContextValue {
  cargo: string | null
  modulos: Modulo[]
  isAdmin: boolean
  loadingRBAC: boolean
}

const RBACContext = createContext<RBACContextValue | null>(null)

export function RBACProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [cargo, setCargo] = useState<string | null>(null)
  const [modulos, setModulos] = useState<Modulo[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loadingRBAC, setLoadingRBAC] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) { setLoadingRBAC(false); return }
    loadPermissions(user.id)
  }, [user, authLoading])

  async function loadPermissions(userId: string) {
    setLoadingRBAC(true)

    // Check admin flag in profiles (we'll add is_admin column in S2)
    const { data: profileData } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single()

    if (profileData?.is_admin) {
      setIsAdmin(true)
      setModulos(['notas','lancamento','email','transferencias','relatorios','auditoria','backup','configuracoes','dashboard'])
      setLoadingRBAC(false)
      return
    }

    // Load cargo + modulos via join
    const { data } = await supabase
      .from('usuario_cargos')
      .select('cargo:cargos(nome), cargo_modulos(modulo)')
      .eq('user_id', userId)
      .single()

    if (data) {
      const c = data.cargo as { nome: string } | null
      const mods = (data.cargo_modulos as { modulo: string }[]).map(m => m.modulo as Modulo)
      setCargo(c?.nome ?? null)
      setModulos(mods)
    }

    setLoadingRBAC(false)
  }

  return (
    <RBACContext.Provider value={{ cargo, modulos, isAdmin, loadingRBAC }}>
      {children}
    </RBACContext.Provider>
  )
}

export function useRBAC() {
  const ctx = useContext(RBACContext)
  if (!ctx) throw new Error('useRBAC must be used inside RBACProvider')
  return ctx
}
```

- [ ] **Step 2: Create `src/hooks/usePermission.ts`**

```typescript
import { useRBAC } from '@/contexts/RBACContext'
import type { Modulo } from '@/types/database'

export function usePermission() {
  const { modulos, isAdmin } = useRBAC()

  function hasModule(mod: Modulo): boolean {
    if (isAdmin) return true
    return modulos.includes(mod)
  }

  return { hasModule, isAdmin }
}
```

- [ ] **Step 3: Create `src/components/RequireAuth.tsx`**

```typescript
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useRBAC } from '@/contexts/RBACContext'

export function RequireAuth() {
  const { user, loading } = useAuth()
  const { loadingRBAC, modulos, isAdmin } = useRBAC()

  if (loading || loadingRBAC) {
    return (
      <div className="min-h-screen bg-app dark:bg-app-dark flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  // User with no cargo and not admin → access denied
  if (!isAdmin && modulos.length === 0) return <Navigate to="/acesso-negado" replace />

  return <Outlet />
}
```

- [ ] **Step 4: Create `src/components/RequireModule.tsx`**

```typescript
import { Navigate } from 'react-router-dom'
import { usePermission } from '@/hooks/usePermission'
import type { Modulo } from '@/types/database'

interface Props {
  mod: Modulo
  children: React.ReactNode
}

export function RequireModule({ mod, children }: Props) {
  const { hasModule } = usePermission()
  if (!hasModule(mod)) return <Navigate to="/acesso-negado" replace />
  return <>{children}</>
}
```

- [ ] **Step 5: Create `src/pages/AccessDeniedPage.tsx`**

```typescript
import { useNavigate } from 'react-router-dom'
import { ShieldX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'

export default function AccessDeniedPage() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-app dark:bg-app-dark flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <ShieldX className="w-16 h-16 text-danger mx-auto mb-4" />
        <h1 className="font-heading text-2xl font-bold text-[var(--text)] mb-2">Acesso Negado</h1>
        <p className="text-[var(--text-muted)] mb-6">
          Sua conta não possui permissões atribuídas. Contate o administrador do sistema.
        </p>
        <Button variant="outline" onClick={() => { signOut(); navigate('/login') }}>
          Sair da conta
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add RBAC context, route guards, and access denied page"
```

---

### Task 6: App Shell (Topbar + Sidebar + Layout)

**Files:**
- Create: `src/components/Shell/Shell.tsx`, `src/components/Shell/Topbar.tsx`, `src/components/Shell/Sidebar.tsx`, `src/components/Shell/BottomNav.tsx`
- Create: `src/stores/uiStore.ts`

**Interfaces:**
- Produces: `<Shell>` layout component, `useUIStore()` with `{ darkMode, toggleDark, cmdOpen, setCmdOpen }`
- `NAV_ITEMS` array: `{ path, icon, label, mod }[]`

- [ ] **Step 1: Create `src/stores/uiStore.ts`**

```typescript
import { create } from 'zustand'

interface UIState {
  darkMode: boolean
  cmdOpen: boolean
  toggleDark: () => void
  setCmdOpen: (open: boolean) => void
}

const savedDark = localStorage.getItem('cdv_dark_mode') === '1'
if (savedDark) document.documentElement.classList.add('dark')

export const useUIStore = create<UIState>((set, get) => ({
  darkMode: savedDark,
  cmdOpen: false,
  toggleDark: () => {
    const next = !get().darkMode
    set({ darkMode: next })
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('cdv_dark_mode', next ? '1' : '')
  },
  setCmdOpen: (open) => set({ cmdOpen: open }),
}))
```

- [ ] **Step 2: Create `src/components/Shell/Sidebar.tsx`**

```typescript
import { NavLink } from 'react-router-dom'
import {
  FileText, Plus, Mail, ArrowRightLeft, Truck, RefreshCw,
  ShoppingCart, FileDown, BarChart2, FileBarChart, Search,
  ClipboardList, Database, Settings
} from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'
import { cn } from '@/lib/utils'
import type { Modulo } from '@/types/database'

export const NAV_ITEMS = [
  { path: '/app/home', icon: BarChart2, label: 'Início', mod: null },
  { path: '/app/notas', icon: FileText, label: 'Notas', mod: 'notas' as Modulo },
  { path: '/app/lancamento', icon: Plus, label: 'Lançamento', mod: 'lancamento' as Modulo },
  { path: '/app/email', icon: Mail, label: 'E-mail', mod: 'email' as Modulo },
  { path: '/app/transferencias', icon: ArrowRightLeft, label: 'Transferências', mod: 'transferencias' as Modulo },
  { path: '/app/frete', icon: Truck, label: 'Frete', mod: 'transferencias' as Modulo },
  { path: '/app/reabertura', icon: RefreshCw, label: 'Reabertura', mod: 'notas' as Modulo },
  { path: '/app/venda', icon: ShoppingCart, label: 'Venda', mod: 'notas' as Modulo },
  { path: '/app/exportar-pdf', icon: FileDown, label: 'Exportar PDF', mod: 'notas' as Modulo },
  { path: '/app/dashboard', icon: BarChart2, label: 'Dashboard', mod: 'dashboard' as Modulo },
  { path: '/app/relatorios', icon: FileBarChart, label: 'Relatórios', mod: 'relatorios' as Modulo },
  { path: '/app/busca', icon: Search, label: 'Busca', mod: null },
  { path: '/app/auditoria', icon: ClipboardList, label: 'Auditoria', mod: 'auditoria' as Modulo },
  { path: '/app/backup', icon: Database, label: 'Backup', mod: 'backup' as Modulo },
  { path: '/app/configuracoes', icon: Settings, label: 'Configurações', mod: 'configuracoes' as Modulo },
]

export function Sidebar() {
  const { hasModule } = usePermission()

  const visible = NAV_ITEMS.filter(item => !item.mod || hasModule(item.mod))

  return (
    <nav className="hidden md:flex flex-col w-56 min-h-screen bg-surface dark:bg-surface-dark border-r border-[var(--border)] pt-2 pb-4 overflow-y-auto">
      {visible.map(item => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-btn text-sm transition-colors',
              isActive
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)]'
            )
          }
        >
          <item.icon className="w-4 h-4 flex-shrink-0" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
```

- [ ] **Step 3: Create `src/components/Shell/Topbar.tsx`**

```typescript
import { Moon, Sun, Search } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'

export function Topbar() {
  const { darkMode, toggleDark, setCmdOpen } = useUIStore()
  const { profile, signOut } = useAuth()

  return (
    <header className="h-14 flex items-center px-4 border-b border-[var(--border)] bg-surface dark:bg-surface-dark gap-3 flex-shrink-0">
      <span className="font-heading font-bold text-primary text-lg flex-1">
        Controle de Devoluções
      </span>

      <Button variant="ghost" size="icon" onClick={() => setCmdOpen(true)} title="Buscar (Ctrl+K)">
        <Search className="w-4 h-4" />
      </Button>

      <Button variant="ghost" size="icon" onClick={toggleDark}>
        {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </Button>

      <button
        onClick={() => signOut()}
        className="w-8 h-8 rounded-full bg-primary text-white text-sm font-semibold flex items-center justify-center hover:bg-primary-hover transition-colors"
        title={profile?.nome ?? profile?.email ?? 'Usuário'}
      >
        {(profile?.nome ?? profile?.email ?? 'U')[0].toUpperCase()}
      </button>
    </header>
  )
}
```

- [ ] **Step 4: Create `src/components/Shell/BottomNav.tsx`**

```typescript
import { NavLink } from 'react-router-dom'
import { FileText, Plus, ArrowRightLeft, BarChart2, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const BOTTOM_ITEMS = [
  { path: '/app/home', icon: BarChart2, label: 'Início' },
  { path: '/app/notas', icon: FileText, label: 'Notas' },
  { path: '/app/lancamento', icon: Plus, label: 'Lançar' },
  { path: '/app/transferencias', icon: ArrowRightLeft, label: 'Transf.' },
  { path: '/app/configuracoes', icon: Settings, label: 'Config.' },
]

export function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface dark:bg-surface-dark border-t border-[var(--border)] flex z-40">
      {BOTTOM_ITEMS.map(item => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            cn(
              'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors',
              isActive ? 'text-primary' : 'text-[var(--text-muted)]'
            )
          }
        >
          <item.icon className="w-5 h-5" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
```

- [ ] **Step 5: Create `src/components/Shell/Shell.tsx`**

```typescript
import { Outlet } from 'react-router-dom'
import { Topbar } from './Topbar'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'

export function Shell() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-app dark:bg-app-dark">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto pb-16 md:pb-0">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add app shell with topbar, sidebar, and mobile bottom nav"
```

---

### Task 7: Router + App Entry

**Files:**
- Modify: `src/App.tsx`, `src/main.tsx`

**Interfaces:**
- Produces: Full routing tree with auth guards and lazy-loaded pages

- [ ] **Step 1: Replace `src/App.tsx`**

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/AuthContext'
import { RBACProvider } from '@/contexts/RBACContext'
import { Shell } from '@/components/Shell/Shell'
import { RequireAuth } from '@/components/RequireAuth'
import { RequireModule } from '@/components/RequireModule'
import { lazy, Suspense } from 'react'

// Eager-loaded (small, critical path)
import LoginPage from '@/pages/LoginPage'
import AccessDeniedPage from '@/pages/AccessDeniedPage'

// Lazy-loaded (loaded on demand)
const HomePage = lazy(() => import('@/pages/HomePage'))

// Other pages (to be added by S3–S7 sub-projects)
// Each sub-project adds its lazy imports here

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
})

const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
)

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <RBACProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/acesso-negado" element={<AccessDeniedPage />} />

              <Route element={<RequireAuth />}>
                <Route element={<Shell />}>
                  <Route path="/app/home" element={
                    <Suspense fallback={<PageLoader />}>
                      <HomePage />
                    </Suspense>
                  } />
                  {/* S3–S7 routes added here */}
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/app/home" replace />} />
            </Routes>
          </BrowserRouter>
        </RBACProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 2: Replace `src/main.tsx`**

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 3: Create placeholder `src/pages/HomePage.tsx`**

```typescript
export default function HomePage() {
  return (
    <div className="p-6">
      <h1 className="font-heading text-2xl font-bold text-[var(--text)]">
        Bem-vindo ao Controle de Devoluções
      </h1>
      <p className="text-[var(--text-muted)] mt-2">KPIs e Quick Notes serão adicionados aqui.</p>
    </div>
  )
}
```

- [ ] **Step 4: Verify app loads**

```bash
npm run dev
```

Navigate to `http://localhost:5173` — should redirect to `/login`. Login with Supabase credentials — should redirect to `/app/home` and show shell with sidebar.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: wire up router with auth guards and lazy loading"
```

---

### Task 8: Command Palette (Ctrl+K)

**Files:**
- Create: `src/components/CommandPalette.tsx`
- Modify: `src/components/Shell/Shell.tsx` (add CommandPalette)

**Interfaces:**
- Produces: `<CommandPalette>` dialog triggered by `Ctrl+K` or topbar button

- [ ] **Step 1: Create `src/components/CommandPalette.tsx`**

```typescript
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Command } from 'cmdk'
import { useUIStore } from '@/stores/uiStore'
import { usePermission } from '@/hooks/usePermission'
import { NAV_ITEMS } from '@/components/Shell/Sidebar'

export function CommandPalette() {
  const { cmdOpen, setCmdOpen } = useUIStore()
  const { hasModule } = usePermission()
  const navigate = useNavigate()

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen(true)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [setCmdOpen])

  function go(path: string) {
    navigate(path)
    setCmdOpen(false)
  }

  if (!cmdOpen) return null

  const items = NAV_ITEMS.filter(item => !item.mod || hasModule(item.mod))

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-[15vh]"
      onClick={() => setCmdOpen(false)}
    >
      <div
        className="w-full max-w-lg bg-surface dark:bg-surface-dark rounded-card shadow-soft-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <Command>
          <div className="border-b border-[var(--border)] px-4">
            <Command.Input
              autoFocus
              placeholder="Buscar módulo ou ação..."
              className="w-full py-3 bg-transparent text-[var(--text)] outline-none text-sm placeholder:text-[var(--text-muted)]"
            />
          </div>
          <Command.List className="max-h-72 overflow-y-auto py-2">
            <Command.Empty className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">
              Nenhum resultado encontrado.
            </Command.Empty>
            {items.map(item => (
              <Command.Item
                key={item.path}
                onSelect={() => go(item.path)}
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm text-[var(--text)] hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add to `src/components/Shell/Shell.tsx`**

```typescript
import { CommandPalette } from '@/components/CommandPalette'

export function Shell() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-app dark:bg-app-dark">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto pb-16 md:pb-0">
          <Outlet />
        </main>
      </div>
      <BottomNav />
      <CommandPalette />
    </div>
  )
}
```

- [ ] **Step 3: Verify Ctrl+K opens palette**

Run dev server, navigate to `/app/home`, press `Ctrl+K` — palette should open with navigation items.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Ctrl+K command palette with nav items"
```

---

### Task 9: Toast System + Undo Bar

**Files:**
- Create: `src/components/Toast.tsx`, `src/components/UndoBar.tsx`
- Create: `src/stores/toastStore.ts`, `src/stores/undoStore.ts`
- Modify: `src/components/Shell/Shell.tsx`

**Interfaces:**
- Produces: `toast(message, type)` global function (ok/err/warn/info)
- `showUndo(message, onUndo, durationMs?)` global function
- `useToastStore()`, `useUndoStore()`

- [ ] **Step 1: Create `src/stores/toastStore.ts`**

```typescript
import { create } from 'zustand'

export type ToastType = 'ok' | 'err' | 'warn' | 'info'

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

interface ToastState {
  toasts: ToastItem[]
  show: (message: string, type: ToastType) => void
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (message, type) => {
    const id = Math.random().toString(36).slice(2)
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 3000)
  },
  dismiss: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))

// Imperative API usable outside components
export const toast = (message: string, type: ToastType = 'info') => {
  useToastStore.getState().show(message, type)
}
```

- [ ] **Step 2: Create `src/components/Toast.tsx`**

```typescript
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useToastStore } from '@/stores/toastStore'
import { cn } from '@/lib/utils'

const ICONS = {
  ok: <CheckCircle className="w-4 h-4" />,
  err: <XCircle className="w-4 h-4" />,
  warn: <AlertTriangle className="w-4 h-4" />,
  info: <Info className="w-4 h-4" />,
}

const CLASSES = {
  ok: 'bg-positive text-white',
  err: 'bg-danger text-white',
  warn: 'bg-warning text-white',
  info: 'bg-primary text-white',
}

export function Toast() {
  const { toasts, dismiss } = useToastStore()

  return (
    <div className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-btn shadow-soft-lg text-sm font-medium pointer-events-auto min-w-[220px] max-w-sm',
              CLASSES[t.type]
            )}
          >
            {ICONS[t.type]}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="opacity-70 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 3: Create `src/stores/undoStore.ts`**

```typescript
import { create } from 'zustand'

interface UndoState {
  message: string | null
  onUndo: (() => void) | null
  timeoutId: ReturnType<typeof setTimeout> | null
  show: (message: string, onUndo: () => void, durationMs?: number) => void
  execute: () => void
  dismiss: () => void
}

export const useUndoStore = create<UndoState>((set, get) => ({
  message: null,
  onUndo: null,
  timeoutId: null,
  show: (message, onUndo, durationMs = 15000) => {
    const existing = get().timeoutId
    if (existing) clearTimeout(existing)
    const id = setTimeout(() => set({ message: null, onUndo: null, timeoutId: null }), durationMs)
    set({ message, onUndo, timeoutId: id })
  },
  execute: () => {
    const { onUndo, timeoutId } = get()
    if (timeoutId) clearTimeout(timeoutId)
    onUndo?.()
    set({ message: null, onUndo: null, timeoutId: null })
  },
  dismiss: () => {
    const { timeoutId } = get()
    if (timeoutId) clearTimeout(timeoutId)
    set({ message: null, onUndo: null, timeoutId: null })
  },
}))

export const showUndo = (message: string, onUndo: () => void, durationMs = 15000) => {
  useUndoStore.getState().show(message, onUndo, durationMs)
}
```

- [ ] **Step 4: Create `src/components/UndoBar.tsx`**

```typescript
import { AnimatePresence, motion } from 'framer-motion'
import { useUndoStore } from '@/stores/undoStore'

export function UndoBar() {
  const { message, execute, dismiss } = useUndoStore()

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ y: 80 }}
          animate={{ y: 0 }}
          exit={{ y: 80 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-20 md:bottom-4 right-4 z-40 bg-[#1E293B] text-white rounded-btn shadow-soft-lg flex items-center gap-3 px-4 py-3 text-sm"
        >
          <span>{message}</span>
          <button
            onClick={execute}
            className="font-semibold text-primary-300 hover:text-primary-200 underline underline-offset-2"
          >
            Desfazer
          </button>
          <button onClick={dismiss} className="text-slate-400 hover:text-white ml-1 text-xs">✕</button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 5: Add Toast + UndoBar to Shell**

```typescript
// In Shell.tsx, add imports and components:
import { Toast } from '@/components/Toast'
import { UndoBar } from '@/components/UndoBar'

// Inside Shell JSX, after <CommandPalette />:
// <Toast />
// <UndoBar />
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add toast system and undo bar with Zustand stores"
```

---

### Task 10: Global Hotkeys

**Files:**
- Create: `src/hooks/useHotkeys.ts`
- Modify: `src/components/Shell/Shell.tsx`

**Interfaces:**
- Produces: `useHotkeys()` hook wired into Shell — Alt+1 through Alt+5 for navigation, Ctrl+D for dark mode toggle

- [ ] **Step 1: Create `src/hooks/useHotkeys.ts`**

```typescript
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUIStore } from '@/stores/uiStore'

const HOTKEY_ROUTES: Record<string, string> = {
  '1': '/app/notas',
  '2': '/app/lancamento',
  '3': '/app/email',
  '4': '/app/transferencias',
  '5': '/app/dashboard',
  '6': '/app/relatorios',
}

export function useHotkeys() {
  const navigate = useNavigate()
  const { toggleDark } = useUIStore()

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.altKey && HOTKEY_ROUTES[e.key]) {
        e.preventDefault()
        navigate(HOTKEY_ROUTES[e.key])
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault()
        toggleDark()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, toggleDark])
}
```

- [ ] **Step 2: Wire into Shell**

```typescript
// In Shell.tsx, add:
import { useHotkeys } from '@/hooks/useHotkeys'

export function Shell() {
  useHotkeys()
  // ... rest unchanged
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add global hotkeys (Alt+1-6 navigation, Ctrl+D dark mode)"
```

---

### Task 11: TypeScript Path Aliases + Build Verification

**Files:**
- Modify: `tsconfig.json`, `vite.config.ts`

**Interfaces:**
- Produces: `@/` alias resolving to `src/`, working production build

- [ ] **Step 1: Update `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 2: Update `vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

- [ ] **Step 3: Install path dependency**

```bash
npm install -D @types/node
```

- [ ] **Step 4: Run type check and build**

```bash
npx tsc --noEmit && npm run build
```

Expected: No TypeScript errors, build succeeds in `dist/`.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: S1 complete — foundation, auth, RBAC, shell, hotkeys"
```
