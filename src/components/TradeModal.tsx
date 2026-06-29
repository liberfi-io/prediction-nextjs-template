"use client";

import {
  ModalBody,
  ModalContent,
  ModalHeader,
  StyledModal,
  useScreen,
} from "@liberfi.io/ui";

/**
 * Trade modal backed by the shared Modal primitive so stacking, focus trapping,
 * scroll lock and outside dismissal stay consistent with the rest of the app.
 */
export function TradeModal({
  open,
  onClose,
  title,
  children,
  hideHeader = false,
  contentClassName,
  bodyClassName,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  hideHeader?: boolean;
  contentClassName?: string;
  bodyClassName?: string;
}) {
  const { isMobile } = useScreen();

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) onClose();
  };

  return (
    <StyledModal
      isOpen={open}
      onOpenChange={handleOpenChange}
      placement={isMobile ? "bottom" : "center"}
      size="lg"
    >
      <ModalContent className={contentClassName}>
        {!hideHeader && (
          <ModalHeader className="px-5 pt-5 pb-3">
            <span className="text-lg font-semibold text-white">{title}</span>
          </ModalHeader>
        )}
        <ModalBody className={bodyClassName ?? "px-5 pb-5 pt-0"}>
          {children}
        </ModalBody>
      </ModalContent>
    </StyledModal>
  );
}
