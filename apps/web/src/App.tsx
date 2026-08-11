import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import { Skeleton } from './components/ui';

// Code splitting: el catálogo y el home cargan primero; el resto llega cuando
// el cliente realmente lo necesita, en vez de en el bundle inicial.
const Catalogo = lazy(() => import('./pages/Catalogo'));
const Producto = lazy(() => import('./pages/Producto'));
const Carrito = lazy(() => import('./pages/Carrito'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Entrar = lazy(() => import('./pages/Entrar'));
const MisPedidos = lazy(() => import('./pages/MisPedidos'));
const Seguimiento = lazy(() => import('./pages/Seguimiento'));
const Admin = lazy(() => import('./pages/Admin'));

const Cargando = () => (
  <div className="mx-auto max-w-7xl space-y-4 px-4 py-16">
    <Skeleton className="h-8 w-1/3" />
    <Skeleton className="h-64 w-full" />
  </div>
);

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route
          path="catalogo"
          element={
            <Suspense fallback={<Cargando />}>
              <Catalogo />
            </Suspense>
          }
        />
        <Route
          path="producto/:id"
          element={
            <Suspense fallback={<Cargando />}>
              <Producto />
            </Suspense>
          }
        />
        <Route
          path="carrito"
          element={
            <Suspense fallback={<Cargando />}>
              <Carrito />
            </Suspense>
          }
        />
        <Route
          path="checkout"
          element={
            <Suspense fallback={<Cargando />}>
              <Checkout />
            </Suspense>
          }
        />
        <Route
          path="entrar"
          element={
            <Suspense fallback={<Cargando />}>
              <Entrar />
            </Suspense>
          }
        />
        <Route
          path="seguimiento"
          element={
            <Suspense fallback={<Cargando />}>
              <Seguimiento />
            </Suspense>
          }
        />
        <Route
          path="mis-pedidos"
          element={
            <Suspense fallback={<Cargando />}>
              <MisPedidos />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>

      {/* El panel va fuera de <Layout>: tiene su propia cabecera y no muestra
          la tienda alrededor. Se sale de él con "Ver como cliente". */}
      <Route
        path="admin/:seccion?"
        element={
          <Suspense fallback={<Cargando />}>
            <Admin />
          </Suspense>
        }
      />
    </Routes>
  );
}
