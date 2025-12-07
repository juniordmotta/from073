import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface ValidatedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  touched?: boolean;
  showSuccess?: boolean;
  hint?: string;
}

const ValidatedInput = React.forwardRef<HTMLInputElement, ValidatedInputProps>(
  ({ className, label, error, touched, showSuccess, hint, id, ...props }, ref) => {
    const hasError = touched && error;
    const isValid = touched && !error && showSuccess && props.value;

    return (
      <div className="space-y-1.5">
        {label && (
          <Label htmlFor={id} className={cn(hasError && "text-destructive")}>
            {label}
            {props.required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        <div className="relative">
          <Input
            ref={ref}
            id={id}
            className={cn(
              "pr-10 transition-colors",
              hasError && "border-destructive focus-visible:ring-destructive/30",
              isValid && "border-green-500 focus-visible:ring-green-500/30",
              className
            )}
            aria-invalid={hasError ? "true" : "false"}
            aria-describedby={hasError ? `${id}-error` : hint ? `${id}-hint` : undefined}
            {...props}
          />
          {hasError && (
            <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
          )}
          {isValid && (
            <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
          )}
        </div>
        {hasError && (
          <p id={`${id}-error`} className="text-xs text-destructive flex items-center gap-1">
            {error}
          </p>
        )}
        {!hasError && hint && (
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

ValidatedInput.displayName = "ValidatedInput";

export { ValidatedInput };
