import { useBackend } from '@/features/backend/backend-context'
import { id } from '@/features/backend/adapters'

export function ServerAvatarPicker({ value, onChange }: { value?: number; onChange: (id: number) => void }) {
  const { avatars } = useBackend()
  return <fieldset className="mt-6">
    <legend className="type-section-title">내 아바타</legend>
    {!avatars.length && <p className="mt-4 text-muted">선택할 수 있는 아바타가 없어요.</p>}
    <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
      {avatars.map(avatar => <label key={id(avatar.id)} className="flex cursor-pointer flex-col items-center gap-3 rounded-card bg-panel p-4">
        {avatar.thumbnailUrl && <img src={avatar.thumbnailUrl} alt="" className="h-36 w-full object-contain" />}
        <span>{avatar.name}</span>
        <input type="radio" name="serverAvatar" value={avatar.id} checked={value === avatar.id} onChange={() => onChange(avatar.id!)} />
      </label>)}
    </div>
  </fieldset>
}
