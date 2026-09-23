"use client";

import { useFormStatus } from "react-dom";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string };

export function SubmitButton({ children, pendingText, className, ...rest }: Props) {
  const { pending } = useFormStatus();
  return (
    <button {...rest} type="submit" disabled={pending || rest.disabled} className={className ?? "btn-primary"}>
      {pending ? (pendingText ?? "Saving…") : children}
    </button>
  );
}
