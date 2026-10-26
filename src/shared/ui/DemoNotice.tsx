export function DemoNotice({ compact = false }: { compact?: boolean }) {
  return (
    <p
      className={
        compact ? 'text-[10px] text-subtle' : 'mt-5 text-center text-xs leading-5 text-subtle'
      }
    >
      데모 화면 · 실제 촬영·결제 없이 체험해요
    </p>
  )
}
