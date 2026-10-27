import Link from "next/link";
import { AccountMenu } from "@/components/account-menu";
import { BottomNav } from "@/components/bottom-nav";
import { HeaderNav } from "@/components/header-nav";
import { HeaderSearch } from "@/components/header-search";
import { canEdit, currentUser, isKeeper } from "@/lib/auth";
import { countPendingRequests } from "@/lib/requests";

/**
 * Шапка: слева название, разделы (не больше трёх), справа — одна кнопка
 * аккаунта. На телефоне разделы уходят в нижнюю панель. Без входа — только название.
 */
export async function Header() {
  const user = await currentUser();
  if (!user) {
    return (
      <header className="site-header">
        <div className="site-header-inner">
          <Link href="/login" className="site-logo">
            Древо села
          </Link>
        </div>
      </header>
    );
  }

  const personId = user.personId;
  const pending = isKeeper(user.role) ? await countPendingRequests() : 0;

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <Link href="/" className="site-logo">
            Древо села
          </Link>
          <HeaderSearch />
          <HeaderNav personId={personId} loggedIn />
          <div className="site-header-end">
            <Link href="/#find" className="site-search-icon" aria-label="Поиск человека">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </Link>
            <AccountMenu
              name={user.name}
              role={user.role}
              canEdit={canEdit(user.role)}
              personId={personId}
              pending={pending}
            />
          </div>
        </div>
      </header>
      <BottomNav personId={personId} loggedIn />
    </>
  );
}
