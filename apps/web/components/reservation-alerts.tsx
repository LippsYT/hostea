 'use client';

 import { useEffect, useRef } from 'react';

 type Reservation = {
   id: string;
   status: string;
   createdAt: string;
 };

 type ReservationAlertsProps = {
   roles: string[];
 };

 const playCashSound = () => {
   try {
     const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
     const osc = ctx.createOscillator();
     const gain = ctx.createGain();
     osc.type = 'sine';
     osc.frequency.value = 880;
     gain.gain.value = 0.15;
     osc.connect(gain);
     gain.connect(ctx.destination);
     osc.start();
     osc.stop(ctx.currentTime + 0.15);
     setTimeout(() => ctx.close(), 200);
   } catch {
     // no-op
   }
 };

 const notify = (count: number) => {
   if (typeof window === 'undefined') return;
   if ('Notification' in window) {
     if (Notification.permission === 'default') {
       Notification.requestPermission().catch(() => undefined);
     } else if (Notification.permission === 'granted') {
       new Notification('Nueva reserva confirmada', {
         body: count === 1 ? 'Tenés una nueva reserva.' : `Tenés ${count} nuevas reservas.`,
         silent: true
       });
     }
   }
   playCashSound();
 };

 export const ReservationAlerts = ({ roles }: ReservationAlertsProps) => {
   const lastSeenRef = useRef<number>(0);

   useEffect(() => {
     if (!roles?.length) return;
     const isAdmin = roles.includes('ADMIN');
     const isHost = roles.includes('HOST');
     if (!isAdmin && !isHost) return;

     const endpoint = isAdmin ? '/api/admin/reservations' : '/api/host/reservations';
     const storageKey = isAdmin ? 'hostea_last_admin_res' : 'hostea_last_host_res';

     const poll = async () => {
       try {
         const res = await fetch(endpoint);
         if (!res.ok) return;
         const data = await res.json();
         const reservations: Reservation[] = data?.reservations || [];
         const lastSeen = Number(localStorage.getItem(storageKey) || 0);
         lastSeenRef.current = lastSeen;
         const latest = reservations.reduce((max, r) => {
           const ts = new Date(r.createdAt).getTime();
           return ts > max ? ts : max;
         }, 0);
         const newConfirmed = reservations.filter((r) => {
           const ts = new Date(r.createdAt).getTime();
           return ts > lastSeen && r.status === 'CONFIRMED';
         });
         if (newConfirmed.length > 0) {
           notify(newConfirmed.length);
         }
         if (latest > 0) {
           localStorage.setItem(storageKey, String(latest));
         }
       } catch {
         // no-op
       }
     };

     poll();
     const timer = setInterval(poll, 30000);
     return () => clearInterval(timer);
   }, [roles]);

   return null;
 };
