import WishlistPage from './wishlist';

/**
 * Legacy Suggestions portal route that now shares the Amazon wishlist experience.
 *
 * The original suggestions endpoints have been superseded by the wishlist
 * service, so the suggestions route simply renders the wishlist page to keep
 * existing navigation links working while using the new backend API.
 */
export default function SuggestionsPortal() {
  return <WishlistPage />;
}
