-- Enlace de cobro por pedido.
--
-- Se guarda en la orden y no en una tabla aparte porque es un dato de ese
-- pedido concreto: el monto del enlace corresponde a su total. Nullable porque
-- la mayoría de los pedidos son contra entrega y nunca llevan uno.
ALTER TABLE "orders" ADD COLUMN "enlace_pago" TEXT;
