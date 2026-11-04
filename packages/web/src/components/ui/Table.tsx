import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface TableProps {
  /** Set a max height here for the sticky header to engage. */
  containerClassName?: string;
  className?: string;
  children: ReactNode;
}

export function Table({ containerClassName, className, children }: TableProps) {
  return (
    <div className={clsx('overflow-x-auto', containerClassName)}>
      <table
        className={clsx('num w-full border-collapse text-body', className)}
      >
        {children}
      </table>
    </div>
  );
}

interface CellOptions {
  /** Right-aligns the cell. Money columns always use this. */
  numeric?: boolean;
}

export function Th({
  numeric,
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & CellOptions) {
  return (
    <th
      scope="col"
      className={clsx(
        'sticky top-0 border-b border-line bg-paper px-5 py-2.5 text-caption font-medium whitespace-nowrap text-ink-2',
        numeric ? 'text-right' : 'text-left',
        className,
      )}
      {...props}
    />
  );
}

export function Td({
  numeric,
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & CellOptions) {
  return (
    <td
      className={clsx(
        'px-5 py-1.5',
        numeric ? 'text-right whitespace-nowrap' : 'text-left',
        className,
      )}
      {...props}
    />
  );
}

/** The empty side of a ledger leg. */
export function EmptyAmount() {
  return (
    <Td numeric className="text-ink-faint">
      —
    </Td>
  );
}
