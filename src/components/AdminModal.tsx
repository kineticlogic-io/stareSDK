/**
 * AdminModal — thin alias over the standard <Modal>. Retained for existing admin
 * call sites; new code should import Modal from './Modal' directly.
 */
import type { ReactNode } from 'react'
import { Modal } from './Modal'

interface AdminModalProps {
  onClose: () => void
  title: string
  children: ReactNode
  width?: number
}

export function AdminModal({ onClose, title, children, width = 480 }: AdminModalProps) {
  return (
    <Modal onClose={onClose} title={title} width={width}>
      {children}
    </Modal>
  )
}
