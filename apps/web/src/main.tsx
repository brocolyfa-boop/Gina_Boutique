import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import LimiteDeError from './components/LimiteDeError';
import { AuthProvider } from './store/auth';
import { CarritoProvider } from './store/carrito';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // El catálogo no cambia cada segundo: se cachea 1 minuto y no se refetchea
      // al volver a la pestaña. Menos peticiones y una web que se siente ligera.
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const raiz = document.getElementById('root');
if (!raiz) throw new Error('Falta el elemento #root en index.html');

createRoot(raiz).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {/* Último recinto: pase lo que pase, el cliente ve un mensaje y un
            botón para recargar, nunca una pantalla en blanco. */}
        <LimiteDeError donde="la tienda">
          <AuthProvider>
            <CarritoProvider>
              <App />
            </CarritoProvider>
          </AuthProvider>
        </LimiteDeError>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
