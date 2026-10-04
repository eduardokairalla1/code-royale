/**
 * Hand-drawn select, keyboard and screen reader friendly.
 */

// --- IMPORTS ---
import { SketchFrame } from '../sketch-frame/sketch-frame.tsx';
import styles from './select.module.css';
import { Select as RadixSelect } from 'radix-ui';

// --- CODE ---
/**
 * One option of the select.
 */
export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Props of the select.
 */
export interface SelectProps {
  // accessible name, since there is no visible label
  label: string;
  value: string;
  options: SelectOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
}

/**
 * Render a sketched select.
 *
 * @param {SelectProps} props The options, the value and the change handler.
 *
 * @returns {JSX.Element} The select.
 */
export function Select({
  label,
  value,
  options,
  disabled = false,
  onChange,
}: SelectProps) {

  return (
    <RadixSelect.Root
      value={value}
      disabled={disabled}
      onValueChange={onChange}
    >
      <RadixSelect.Trigger className={styles.trigger} aria-label={label}>
        <SketchFrame
          fill={disabled ? undefined : 'var(--paper-light)'}
          shadow={disabled ? 0 : 3}
        />
        <span className={styles.value}>
          <RadixSelect.Value />
        </span>
        <RadixSelect.Icon className={styles.icon}>▾</RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          className={styles.content}
          position="popper"
          sideOffset={8}
        >
          <SketchFrame fill="var(--paper-light)" shadow={5} />
          <RadixSelect.Viewport className={styles.viewport}>
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                className={styles.item}
              >
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className={styles.check}>
                  ✓
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
