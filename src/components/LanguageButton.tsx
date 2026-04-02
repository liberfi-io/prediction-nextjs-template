"use client";

import { Key, useCallback } from "react";
import {
  LocaleCode,
  useTranslation,
  useLocale,
  useChangeLocale,
  useLocaleContext,
} from "@liberfi.io/i18n";
import { cn, TranslateIcon } from "@liberfi.io/ui";
import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react";

export function LanguageButton() {
  const { t } = useTranslation();
  const locale = useLocale();
  const changeLocale = useChangeLocale();
  const { languages } = useLocaleContext();

  const handleChangeLanguage = useCallback(
    (key: Key) => changeLocale(key as LocaleCode),
    [changeLocale],
  );

  return (
    <Dropdown
      placement="bottom-end"
      size="sm"
      classNames={{ content: "bg-content1 border border-border" }}
    >
      <DropdownTrigger>
        <Button
          isIconOnly
          className="bg-content2 w-8 min-w-0 h-8 min-h-0 rounded-full"
          disableRipple
          aria-label={t("extend.header.language")}
        >
          <TranslateIcon width={16} height={16} />
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label={t("extend.header.language")}
        selectionMode="single"
        selectedKeys={[locale]}
        onAction={handleChangeLanguage}
        classNames={{ list: "gap-1" }}
        itemClasses={{
          base: cn("rounded-md px-3 h-8"),
        }}
      >
        {languages.map((lang) => (
          <DropdownItem
            key={lang.localCode}
            className={cn(
              lang.localCode === locale ? "bg-content2 text-foreground" : "text-neutral",
              "data-[hover=true]:bg-content2 data-[hover=true]:text-foreground",
              "data-[selectable=true]:focus:bg-content2 data-[selectable=true]:focus:text-foreground",
            )}
          >
            {lang.displayName}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}
