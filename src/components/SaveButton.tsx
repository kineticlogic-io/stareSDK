import { TbDeviceFloppy } from 'react-icons/tb'
import { Button, type ButtonSize } from './Button'

interface SaveButtonProps {
  /** Whether the value differs from the last-saved baseline. The button is disabled until this is true. */
  dirty: boolean
  saving: boolean
  saved: boolean
  onSave: () => void
  size?: ButtonSize
}

/**
 * Compact save control for settings rows. Place it right-aligned at the end of the
 * row/expander whose value it saves. Disabled until `dirty`; shows "Saved" briefly
 * after a successful save. Solid (primary) when there are unsaved changes.
 */
export function SaveButton({ dirty, saving, saved, onSave, size = 'sm' }: SaveButtonProps) {
  const label = saving ? 'Saving…' : saved && !dirty ? 'Saved' : 'Save'
  return (
    <Button
      size={size}
      variant={dirty ? 'primary' : 'secondary'}
      icon={<TbDeviceFloppy />}
      disabled={!dirty || saving}
      onClick={onSave}
      aria-label="Save changes"
    >
      {label}
    </Button>
  )
}
