import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import ts from 'typescript'
import type { Plugin } from 'vite'
import type { ReviewMessageTone } from '../src/features/review/messages.ts'

export type ReviewCopyEntry = { id: string; text: string; file: string; line: number; kind: '화면 문구' | '접근성·입력' | '상태·데이터' | '동적 문구' | '약관 전문'; statusTone?: ReviewMessageTone; symbol?: string }
const attributes = new Set(['title', 'label', 'placeholder', 'aria-label', 'alt', 'description', 'message', 'closeLabel', 'eyebrow', 'clearLabel', 'successLabel'])

function messageContext(node: ts.Node, text: string, file: string, sf: ts.SourceFile): { statusTone?: ReviewMessageTone; symbol?: string } {
  let statusTone: ReviewMessageTone | undefined, symbol: string | undefined
  for (let parent = node.parent; parent && !ts.isSourceFile(parent); parent = parent.parent) {
    if (ts.isPropertyAssignment(parent)) {
      const name = parent.name.getText(sf).replace(/^['"]|['"]$/g, '')
      if (!symbol && !['text', 'tone', 'message'].includes(name)) symbol = name
    }
    if (ts.isObjectLiteralExpression(parent)) {
      const tone = parent.properties.find(property => ts.isPropertyAssignment(property) && property.name.getText(sf) === 'tone')
      if (tone && ts.isPropertyAssignment(tone) && ts.isStringLiteral(tone.initializer)) {
        const value = tone.initializer.text
        if (['error', 'success', 'warning', 'info'].includes(value)) statusTone ??= value as ReviewMessageTone
      }
    }
    if (ts.isCallExpression(parent) && /(?:set.*Error|setError|fail)$/.test(parent.expression.getText(sf))) statusTone ??= 'error'
    if (ts.isCallExpression(parent) && /set.*Notice$/.test(parent.expression.getText(sf))) statusTone ??= 'info'
    if (ts.isNewExpression(parent) && /(?:ApiError|Error)$/.test(parent.expression.getText(sf))) statusTone ??= 'error'
    const opening = ts.isJsxElement(parent) ? parent.openingElement : ts.isJsxSelfClosingElement(parent) ? parent : null
    if (opening) {
      const name = opening.tagName.getText(sf)
      if (name === 'FeedbackMessage') {
        const tone = opening.attributes.properties.find(property => ts.isJsxAttribute(property) && property.name.getText(sf) === 'tone')
        statusTone ??= tone && ts.isJsxAttribute(tone) && tone.initializer && ts.isStringLiteral(tone.initializer)
          ? tone.initializer.text as ReviewMessageTone : 'info'
      }
      if (name === 'EmptyState') statusTone ??= 'empty'
      const role = opening.attributes.properties.find(property => ts.isJsxAttribute(property) && property.name.getText(sf) === 'role')
      if (role && ts.isJsxAttribute(role) && role.initializer && ts.isStringLiteral(role.initializer)) {
        if (role.initializer.text === 'alert') statusTone ??= 'error'
        if (role.initializer.text === 'status') statusTone ??= 'info'
      }
    }
  }
  if (file.endsWith('/api/client.ts') || file.endsWith('/email-validation.ts') || file.endsWith('/device-controller.ts')) statusTone ??= 'error'
  if (!statusTone && /되돌릴 수 없|삭제돼요/.test(text)) statusTone = 'warning'
  if (!statusTone && /(?:아직|등록된|저장한|진행 중인|선택할 수 있는).*(?:없어요|없습니다)|검색 결과가 없|선택한 날짜에는.*없|지난 일정이 없|페이지를 찾을 수 없|기록이 없|내역이 없|비어 있/.test(text)) statusTone = 'empty'
  if ((!statusTone || statusTone === 'info') && /하고 있어요|불러오고|연결 중|로그인하고|답장을 기다/.test(text)) statusTone = 'loading'
  return { ...(statusTone ? { statusTone } : {}), ...(symbol ? { symbol } : {}) }
}

/** Extract authored UI strings, retaining repeated occurrences and the original source location. */
export function extractReviewCopy(source: string, file: string): ReviewCopyEntry[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const entries: ReviewCopyEntry[] = []
  const add = (node: ts.Node, text: string, kind: ReviewCopyEntry['kind']) => {
    const normalized = text.replace(/\s+/g, ' ').trim()
    if (!normalized) return
    const position = node.getStart(sf)
    entries.push({ id: `${file}:${position}`, text: normalized, file, line: sf.getLineAndCharacterOfPosition(position).line + 1, kind, ...messageContext(node, normalized, file, sf) })
  }
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) add(node, node.text, '화면 문구')
    else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const parent = node.parent
      if (ts.isJsxAttribute(parent)) {
        if (attributes.has(parent.name.getText(sf))) add(node, node.text, '접근성·입력')
      } else if (!ts.isImportDeclaration(parent) && !ts.isLiteralTypeNode(parent) && /[가-힣]/.test(node.text)) add(node, node.text, '상태·데이터')
    } else if (ts.isTemplateExpression(node) && /[가-힣]/.test(node.getText(sf))) add(node, node.getText(sf).slice(1, -1), '동적 문구')
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return entries
}

export function reviewCopyPlugin(): Plugin {
  return {
    name: 'capsule-review-copy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (request.url?.split('?')[0] !== '/__review/copy') return next()
        if (request.method !== 'GET') { response.statusCode = 405; response.end(); return }
        const entries: ReviewCopyEntry[] = []
        const walk = async (directory: string) => {
          for (const entry of await readdir(directory, { withFileTypes: true })) {
            const full = join(directory, entry.name)
            const file = relative(server.config.root, full).replaceAll('\\', '/')
            if (file.startsWith('src/features/review') || file === 'server/review-copy.ts') continue
            if (entry.isDirectory()) await walk(full)
            else if (/\.tsx?$/.test(entry.name)) entries.push(...extractReviewCopy(await readFile(full, 'utf8'), file))
            else if (/^src\/features\/auth\/data\/legal\/[^/]+\.md$/.test(file) && entry.name !== 'README.md') {
              entries.push({ id: file, file, line: 1, text: await readFile(full, 'utf8'), kind: '약관 전문' })
            }
          }
        }
        try {
          await walk(join(server.config.root, 'src'))
          await walk(join(server.config.root, 'server'))
          await walk(join(server.config.root, 'api'))
          response.setHeader('content-type', 'application/json; charset=utf-8')
          response.setHeader('cache-control', 'no-store')
          response.end(JSON.stringify({ entries, files: new Set(entries.map(entry => entry.file)).size }))
        } catch {
          response.statusCode = 500; response.end(JSON.stringify({ error: '문구 목록을 읽지 못했어요.' }))
        }
      })
    },
  }
}
