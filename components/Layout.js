import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../utils/supabaseClient';

/**
 * Layout component to wrap every page. It applies the dark green theme,
 * renders the top navigation bar and ensures consistent styling. The
 * children prop will contain the page-specific content.
 */
export default function Layout({ children, user }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0a3d62',
        color: 'white',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Head>
        <title>ISAP Bank Simulator</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      {/* Top navigation bar */}
      <nav
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem 1.5rem',
          backgroundColor: '#022b3a',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontWeight: 'bold', fontSize: '1.25rem' }}>ISAP Bank</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {user ? (
            <>
              {user.role === 'client' && user.status === 'approved' && (
                <Link href="/home" legacyBehavior>
                  <a style={{ textDecoration: 'underline' }}>Inicio</a>
                </Link>
              )}
              {user.role === 'bank' && (
                <Link href="/admin" legacyBehavior>
                  <a style={{ textDecoration: 'underline' }}>Panel Admin</a>
                </Link>
              )}
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = '/';
                }}
                style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}
              >
                Salir
              </button>
            </>
          ) : (
            <>
              <Link href="/" legacyBehavior>
                <a style={{ textDecoration: 'underline' }}>Ingresar</a>
              </Link>
              <Link href="/register" legacyBehavior>
                <a style={{ textDecoration: 'underline' }}>Registrarse</a>
              </Link>
            </>
          )}
        </div>
      </nav>
      {/* Main content */}
      <main style={{ flex: 1, padding: '1.5rem' }}>{children}</main>
    </div>
  );
}