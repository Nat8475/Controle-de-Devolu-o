# Auditoria de Paridade — Sistema Legado (GAS) vs. New Devolution (React)

## Contexto

O sistema novo (`New Devolution`, React + Supabase) é uma reescrita do sistema legado
(`Planilha 2`, Google Apps Script + Google Sheets), feita em 7 sprints (S1–S7), já
implementadas e com build passando. O usuário suspeita que funcionalidades existentes
no legado foram simplificadas, removidas ou esquecidas durante a reescrita e quer
restaurar a paridade completa.

Fonte do legado: `C:\Users\datan\OneDrive\Desktop\Planilha 2\` — `Código.gs` (backend,
340KB) + 16 arquivos `Form*.html` / `Index.html` (frontend GAS).

## Objetivo

Auditar, módulo por módulo, cada tela do sistema legado contra o módulo equivalente do
sistema novo, identificar gaps reais (não simplificações intencionais) e implementá-los.

## Não-objetivo

Não é uma reescrita de arquitetura nem uma revisão de design visual — o Design System
v11 já foi adotado no sistema novo. O foco é paridade **funcional** (regras de negócio,
validações, fluxos, campos, permissões).

## Processo (por módulo)

1. Ler o(s) `Form*.html` do legado por completo, incluindo o JS embutido.
2. Ler as funções de `Código.gs` chamadas por esse(s) form(s) (`google.script.run.*`).
3. Ler o módulo equivalente em `src/` (pages, hooks, stores, componentes).
4. Listar gaps: funcionalidade ausente, validação removida, campo faltando, fluxo
   alterado, edge case não tratado.
5. Apresentar a lista ao usuário — aprovação/priorização antes de codar.
6. Implementar os gaps aprovados.
7. Rodar `npm run build` (TypeScript + Vite) para garantir que nada quebrou.
8. Seguir para o próximo módulo.

## Ordem dos módulos

1. **Notas + Lançamento** — `FormNotas.html`, `FormLancamento.html` → `src/pages/notas/*`, `src/pages/lancamento/*`
2. **Operações** — `FormTransferencias.html`, `FormProgramarFrete.html`, `FormVenda.html`, `FormReabertura.html` → `src/pages/transferencias/*`
3. **Comunicação** — `FormEmailDevolucao.html` → `src/pages/email/*`
4. **Analytics** — `FormDashboard.html`, `FormRelatorios.html`, `FormBusca.html`, `FormExportarPDF.html` → `src/pages/dashboard`, `src/pages/relatorios`, `src/components/CommandPalette.tsx`
5. **Admin** — `FormAuditoria.html`, `FormBackup.html`, `FormConfiguracoes.html` → `src/pages/auditoria`, `src/pages/backup`, `src/pages/configuracoes`

S1 (Foundation/Auth) e S2 (Database migration) ficam de fora — são infraestrutura sem
tela de usuário 1:1 no legado.

## Indício já levantado

`package.json` do sistema novo não tem nenhuma biblioteca de geração de PDF
(jsPDF, pdfmake, etc.), enquanto o legado tem uma tela inteira dedicada
(`FormExportarPDF.html`, 25KB) para gerar documento de carga. Provável gap real,
a confirmar na auditoria do módulo Analytics.

## Critério de "gap real" vs. simplificação aceitável

- **Gap real**: funcionalidade que o usuário final perde (uma ação que não pode mais
  fazer, um dado que não é mais validado/registrado, um relatório que não existe mais).
- **Simplificação aceitável**: mudança de implementação técnica que preserva o
  resultado para o usuário (ex: `localStorage` → Zustand store, `google.script.run` →
  Supabase client) — não entra na lista de gaps.

Em caso de dúvida sobre se algo é gap real, perguntar ao usuário em vez de assumir.
