'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { signOut } from '@/lib/session';
import { useWorkspaceStore } from '@/stores/workspace';
import { BrandMark } from './BrandMark';

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

const SERVICE_NAV = [
  {
    segment: 'overview',
    label: 'Overview',
    icon: (
      <>
        <rect x="2" y="2" width="5" height="5" rx="1" />
        <rect x="9" y="2" width="5" height="5" rx="1" />
        <rect x="2" y="9" width="5" height="5" rx="1" />
        <rect x="9" y="9" width="5" height="5" rx="1" />
      </>
    ),
  },
  {
    segment: 'orders',
    label: 'Orders',
    icon: (
      <>
        <path d="M3 2h10v12l-2.5-1.5L8 14l-2.5-1.5L3 14z" />
        <path d="M6 6h4M6 9h4" />
      </>
    ),
  },
  {
    segment: 'transactions',
    label: 'Transactions',
    icon: <path d="M3 5h10l-3-3M13 11H3l3 3" />,
  },
  {
    segment: 'accounts',
    label: 'Accounts',
    icon: <path d="M2 3h12v10H2zM8 3v10M2 7h12" />,
  },
  {
    segment: 'reports',
    label: 'Reports',
    icon: <path d="M3 13V8M8 13V3M13 13V6" />,
  },
  {
    segment: 'api-keys',
    label: 'API keys',
    icon: (
      <>
        <circle cx="5.5" cy="10.5" r="3" />
        <path d="M7.7 8.3L14 2M11 5l2 2" />
      </>
    ),
  },
];

function NavLink({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={clsx(
        'flex h-control items-center gap-2.5 rounded-control px-2.5 no-underline',
        active
          ? 'bg-gold font-medium text-ink hover:text-ink'
          : 'text-ink-body hover:bg-paper hover:text-ink',
      )}
    >
      <Icon>{icon}</Icon>
      {children}
    </Link>
  );
}

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const params = useParams<{ serviceId?: string }>();

  const [signOutFailed, setSignOutFailed] = useState(false);
  const activeServiceId = useWorkspaceStore((state) => state.activeServiceId);
  const setActiveServiceId = useWorkspaceStore(
    (state) => state.setActiveServiceId,
  );

  // The URL decides the service when it names one. Elsewhere, such as on the
  // services list, the last one viewed keeps the service links working.
  const serviceId = params.serviceId ?? activeServiceId;

  useEffect(() => {
    if (params.serviceId) setActiveServiceId(params.serviceId);
  }, [params.serviceId, setActiveServiceId]);

  async function handleSignOut() {
    try {
      await signOut();
      // A full navigation, so guarded pages aren't reused from the router cache.
      window.location.assign('/sign-in');
    } catch {
      setSignOutFailed(true);
    }
  }

  return (
    <nav
      aria-label="Main"
      className="flex flex-col gap-5 border-b border-line bg-surface px-4 py-6 md:sticky md:top-0 md:h-dvh md:w-58 md:shrink-0 md:overflow-y-auto md:border-r md:border-b-0"
    >
      <Link href="/services" className="px-2 no-underline">
        <BrandMark />
      </Link>

      <Link
        href="/services"
        className="flex min-h-10 items-center justify-between gap-2 rounded-control border border-line px-3 py-1 text-small no-underline"
      >
        <span className="flex min-w-0 flex-col">
          <span className="text-[0.6875rem] text-ink-2">Service</span>
          <span className="truncate font-medium">
            {serviceId ?? 'Choose a service'}
          </span>
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
          className="shrink-0"
        >
          <path d="M3 4.5l3-3 3 3M3 7.5l3 3 3-3" />
        </svg>
      </Link>

      {serviceId && (
        <div className="flex flex-col gap-0.5">
          {SERVICE_NAV.map(({ segment, label, icon }) => {
            const href = `/services/${encodeURIComponent(serviceId)}/${segment}`;

            return (
              <NavLink
                key={segment}
                href={href}
                active={pathname.startsWith(href)}
                icon={icon}
              >
                {label}
              </NavLink>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-0.5 border-t border-line pt-4">
        <div className="px-2.5 pb-1.5 text-[0.6875rem] font-medium tracking-[0.08em] text-ink-2 uppercase">
          Workspace
        </div>
        <NavLink
          href="/services"
          active={pathname === '/services'}
          icon={
            <>
              <path d="M2 5h12M2 11h12" />
              <circle cx="5" cy="5" r="1.5" />
              <circle cx="11" cy="11" r="1.5" />
            </>
          }
        >
          All services
        </NavLink>
      </div>

      <div className="flex items-end justify-between gap-2 border-t border-line px-2 pt-3 text-caption text-ink-2 md:mt-auto">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span>Signed in as</span>
          <span className="truncate font-mono text-ink">{email}</span>
        </span>
        <button
          type="button"
          onClick={handleSignOut}
          className="shrink-0 text-ink-body underline"
        >
          {signOutFailed ? 'Sign out failed. Retry' : 'Sign out'}
        </button>
      </div>
    </nav>
  );
}
