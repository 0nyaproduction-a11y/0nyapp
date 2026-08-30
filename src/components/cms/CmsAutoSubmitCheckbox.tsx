"use client";

import type { ReactNode } from "react";

type CmsAutoSubmitCheckboxProps = {
  name: string;
  defaultChecked: boolean;
  inputClassName?: string;
  labelClassName?: string;
  children?: ReactNode;
};

export function CmsAutoSubmitCheckbox({
  name,
  defaultChecked,
  inputClassName,
  labelClassName,
  children,
}: CmsAutoSubmitCheckboxProps) {
  return (
    <label className={labelClassName}>
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        onChange={(e) => e.target.form?.requestSubmit()}
        className={inputClassName}
      />
      {children}
    </label>
  );
}
