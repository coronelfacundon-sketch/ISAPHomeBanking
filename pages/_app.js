import '../styles/globals.css';
import '../styles/theme.css';
import Layout from '../components/Layout';
import useUser from '../hooks/useUser';

/**
 * Custom App component that wraps every page with our Layout and provides
 * access to the current user via the useUser hook. This ensures that
 * navigation links and page content adapt based on authentication state.
 */
export default function MyApp({ Component, pageProps }) {
  const { user, loading } = useUser();
  // While the auth state is loading, we can just return nothing to avoid
  // flicker. Once loaded, render the page within the Layout.
  if (loading) return null;
  return (
    <Layout user={user}>
      <Component {...pageProps} user={user} />
    </Layout>
  );
}