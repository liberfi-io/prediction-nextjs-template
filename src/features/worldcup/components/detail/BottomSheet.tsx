"use client";

import { ModalContent, StyledModal, cn } from "@liberfi.io/ui";

/**
 * Mobile bottom sheet used by the World Cup detail page. It is backed by the
 * shared Modal primitive so stacking, focus trapping, scroll lock and outside
 * dismissal stay consistent with the rest of the app.
 */
export function BottomSheet({
  open,
  onClose,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) onClose();
  };

  return (
    <StyledModal
      isOpen={open}
      onOpenChange={handleOpenChange}
      placement="bottom"
      size="lg"
      backdrop="blur"
      hideCloseButton
      scrollBehavior="inside"
      className={cn("pb-[env(safe-area-inset-bottom)]", className)}
      motionProps={{
        variants: {
          enter: {
            y: 0,
            opacity: 1,
            transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] },
          },
          exit: {
            y: 32,
            opacity: 0,
            transition: { duration: 0.16, ease: [0.32, 0.72, 0, 1] },
          },
        },
      }}
    >
      <ModalContent>{children}</ModalContent>
    </StyledModal>
  );
}
