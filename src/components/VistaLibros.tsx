'use client';

import React, { useState } from 'react';
import { VistaDirectorio } from './VistaDirectorio';
import { VistaCartas } from './VistaCartas';
import { VistaActas } from './VistaActas';
import { VistaDocumentos } from './VistaDocumentos';
import { VistaJustificaciones } from './VistaJustificaciones';
import { useAuth } from '@/context/AuthContext';
import { Users, Mail, FileText, FolderOpen, ChevronLeft, ChevronRight, BookOpen, ClipboardList } from 'lucide-react';

type LibroId = 'miembros' | 'cartas' | 'actas' | 'documentos' | 'justificaciones';

interface LibroDefinicion {
  id: LibroId;
  titulo: string;
  descripcion: string;
  icon: React.ElementType;
}

const LIBROS: LibroDefinicion[] = [
  {
    id: 'miembros',
    titulo: 'Miembros',
    descripcion: 'Fichas, datos de contacto y documentos de respaldo de cada integrante.',
    icon: Users
  },
  {
    id: 'cartas',
    titulo: 'Cartas',
    descripcion: 'Correspondencia recibida y emitida, con su folio y estado.',
    icon: Mail
  },
  {
    id: 'actas',
    titulo: 'Actas',
    descripcion: 'Registro de reuniones, temas tratados y acuerdos.',
    icon: FileText
  },
  {
    id: 'documentos',
    titulo: 'Documentos',
    descripcion: 'Constitución, situación tributaria, cuentas bancarias y reglamentos.',
    icon: FolderOpen
  },
  {
    id: 'justificaciones',
    titulo: 'Justificaciones',
    descripcion: 'Padrón de pendientes e historial, con quien envió y quien resolvió.',
    icon: ClipboardList
  }
];

interface VistaLibrosProps {
  onCrearEventoDesdeCarta?: () => void;
}

// Sección Libros: un índice único que agrupa los cuatro libros del ministerio.
export const VistaLibros: React.FC<VistaLibrosProps> = ({ onCrearEventoDesdeCarta }) => {
  const { puede } = useAuth();
  const [libroAbierto, setLibroAbierto] = useState<LibroId | null>(null);
  const librosVisibles = LIBROS.filter(libro => libro.id !== 'justificaciones' || puede('ver_justificaciones'));

  if (libroAbierto) {
    const definicion = LIBROS.find(l => l.id === libroAbierto)!;
    return (
      <div className="space-y-3">
        <button
          onClick={() => setLibroAbierto(null)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-[#0099DD] bg-white border border-slate-200/80 rounded-xl transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Libros / {definicion.titulo}
        </button>

        {libroAbierto === 'miembros' && <VistaDirectorio />}
        {libroAbierto === 'cartas' && (
          <VistaCartas onCrearEventoDesdeCarta={onCrearEventoDesdeCarta} />
        )}
        {libroAbierto === 'actas' && <VistaActas />}
        {libroAbierto === 'documentos' && <VistaDocumentos />}
        {libroAbierto === 'justificaciones' && <VistaJustificaciones />}
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-3xl lg:max-w-6xl mx-auto pb-16">
      <header className="px-1 pt-1 pb-2">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[#0099DD]" />
          Libros
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Índice de los registros institucionales del Ministerio Vocal Solí Deo
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {librosVisibles.map(libro => {
          const Icon = libro.icon;
          return (
            <button
              key={libro.id}
              onClick={() => setLibroAbierto(libro.id)}
              className="text-left bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:border-sky-300 transition-colors group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-[#0099DD]" />
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#0099DD] transition-colors shrink-0" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mt-3 group-hover:text-[#0099DD] transition-colors">
                {libro.titulo}
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{libro.descripcion}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
