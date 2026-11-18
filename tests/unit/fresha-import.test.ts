import { describe, expect, it } from "vitest";
import {
  buildImportRows,
  matchByName,
  parseCsv,
  parseFreshaAppointments,
  parseFreshaClients,
} from "@/lib/domain/fresha-import";

// Archivos inventados: ningún dato real de clientes (CLAUDE.md, Seguridad).
const CLIENTS_EN = [
  "﻿First Name,Last Name,Mobile Number,Email,Date of Birth,Note",
  'Laura,Gómez,+57 300 111 2233,laura@example.com,1990-05-03,"Prefiere, tijera"',
  "Mario,,3001112244,,,",
  "Sin,Celular,,a@b.c,,",
  "Ext,Ranjero,+54 9 11 1234 5678,,,",
  ",,3001112255,,,",
].join("\r\n");

const CLIENTS_ES = [
  "Nombre;Apellido;Número de móvil;Fecha de nacimiento;Notas",
  "José;Pérez;300 111 2266;03/05/1985;",
].join("\n");

const APPTS_EN = [
  "Ref #,Client,Service,Team Member,Scheduled Date,Time,Duration,Status",
  "1001,Laura Gómez,Corte clásico,Pedro,19 Nov 2026,10:00,45min,Booked",
  "1002,Mario,CORTE,Juan,2026-11-20,3:30 PM,1h 15min,Confirmed",
  "1003,Laura Gómez,Corte,Pedro,2026-11-10,10:00,30min,Booked",
  "1004,Laura Gómez,Corte,Pedro,2026-11-21,10:00,30min,Cancelled",
  "1005,Laura Gómez,Corte,Pedro,mañana,10:00,30min,Booked",
].join("\n");

const TODAY = "2026-11-18";

describe("REQ-100 lector de los archivos de Fresha", () => {
  it("REQ-100.4 lee CSV con BOM, comillas, saltos \\r\\n y separador ; o ,", () => {
    expect(parseCsv('a,b\r\n"x, y","di ""hola"""\r\n')).toEqual([
      ["a", "b"],
      ["x, y", 'di "hola"'],
    ]);
    expect(parseCsv("﻿a;b\n1;2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
    expect(parseCsv('a,b\n"línea\nnueva",2')).toEqual([
      ["a", "b"],
      ["línea\nnueva", "2"],
    ]);
  });

  it("REQ-100.3 / REQ-100.4 clientes con títulos en inglés: celular, nombre, cumpleaños y nota", () => {
    const r = parseFreshaClients(parseCsv(CLIENTS_EN));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.clients).toEqual([
      {
        name: "Laura Gómez",
        phone: "+573001112233",
        birthdayDay: 3,
        birthdayMonth: 5,
        notes: "Prefiere, tijera",
      },
      {
        name: "Mario",
        phone: "+573001112244",
        birthdayDay: null,
        birthdayMonth: null,
        notes: null,
      },
    ]);
  });

  it("REQ-100.2 dice por qué descarta cada fila: sin celular, de otro país, sin nombre", () => {
    const r = parseFreshaClients(parseCsv(CLIENTS_EN));
    if (!r.ok) throw new Error("no leyó");
    expect(r.skipped).toEqual([
      { row: 4, reason: "NO_PHONE" },
      { row: 5, reason: "FOREIGN_PHONE" },
      { row: 6, reason: "NO_NAME" },
    ]);
  });

  it("REQ-100.4 el correo no se guarda", () => {
    const r = parseFreshaClients(parseCsv(CLIENTS_EN));
    if (!r.ok) throw new Error("no leyó");
    expect(JSON.stringify(r.clients)).not.toContain("example.com");
  });

  it("REQ-100.4 títulos en español y fecha día/mes/año", () => {
    const r = parseFreshaClients(parseCsv(CLIENTS_ES));
    expect(r.ok && r.clients[0]).toEqual({
      name: "José Pérez",
      phone: "+573001112266",
      birthdayDay: 3,
      birthdayMonth: 5,
      notes: null,
    });
  });

  it("REQ-100.4 nombre de más de 60 letras se corta", () => {
    const long = "A".repeat(70);
    const r = parseFreshaClients([
      ["Name", "Mobile"],
      [long, "3001112277"],
    ]);
    expect(r.ok && r.clients[0].name).toHaveLength(60);
  });

  it("REQ-100.2 un archivo sin columna de celular o de nombre no se puede leer", () => {
    expect(
      parseFreshaClients([
        ["Foo", "Bar"],
        ["1", "2"],
      ]),
    ).toEqual({ ok: false, error: "NO_COLUMNS" });
    expect(parseFreshaClients([])).toEqual({ ok: false, error: "NO_COLUMNS" });
  });

  it("REQ-100.6 citas: solo futuras y reservadas, con hora de Bogotá y duración", () => {
    const r = parseFreshaAppointments(parseCsv(APPTS_EN), TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.appointments).toEqual([
      {
        row: 2,
        ref: "1001",
        clientName: "Laura Gómez",
        phone: null,
        serviceName: "Corte clásico",
        barberName: "Pedro",
        startsAt: "2026-11-19T10:00:00-05:00",
        durationMin: 45,
      },
      {
        row: 3,
        ref: "1002",
        clientName: "Mario",
        phone: null,
        serviceName: "CORTE",
        barberName: "Juan",
        startsAt: "2026-11-20T15:30:00-05:00",
        durationMin: 75,
      },
    ]);
    expect(r.skipped).toEqual([
      { row: 4, reason: "PAST" },
      { row: 5, reason: "NOT_BOOKED" },
      { row: 6, reason: "BAD_DATE" },
    ]);
  });

  it("REQ-100.6 citas en español con fecha y hora juntas y celular", () => {
    const rows = [
      ["Cliente", "Celular", "Servicio", "Profesional", "Fecha y hora", "Duración", "Estado"],
      ["Ana", "300 111 2299", "Barba", "Juan", "25/11/2026 9:15 a. m.", "30 min", "Confirmada"],
      ["Ana", "300 111 2299", "Barba", "Juan", "26/11/2026 12:00 p. m.", "", "Reservada"],
    ];
    const r = parseFreshaAppointments(rows, TODAY);
    expect(r.ok && r.appointments.map((a) => [a.startsAt, a.durationMin, a.phone, a.ref])).toEqual([
      ["2026-11-25T09:15:00-05:00", 30, "+573001112299", null],
      ["2026-11-26T12:00:00-05:00", null, "+573001112299", null],
    ]);
  });

  it("REQ-100.7 empareja nombres sin mayúsculas ni tildes", () => {
    const opts = [
      { id: "a", name: "Corte clásico" },
      { id: "b", name: "Barba" },
    ];
    expect(matchByName("CORTE CLASICO", opts)).toBe("a");
    expect(matchByName("  barba ", opts)).toBe("b");
    expect(matchByName("Cejas", opts)).toBeNull();
  });

  it("REQ-100.7 / REQ-100.6 arma las filas: parejas escogidas, celular por nombre y pendientes", () => {
    const clients = [
      {
        name: "Laura Gómez",
        phone: "+573001112233",
        birthdayDay: null,
        birthdayMonth: null,
        notes: null,
      },
      {
        name: "Mario",
        phone: "+573001112244",
        birthdayDay: null,
        birthdayMonth: null,
        notes: null,
      },
      {
        name: "Mario",
        phone: "+573001112245",
        birthdayDay: null,
        birthdayMonth: null,
        notes: null,
      },
    ];
    const base = { ref: null, phone: null, durationMin: 30, startsAt: "2026-11-19T10:00:00-05:00" };
    const appts = [
      { ...base, row: 2, clientName: "laura gomez", serviceName: "Corte", barberName: "Pedro" },
      { ...base, row: 3, clientName: "Mario", serviceName: "Corte", barberName: "Pedro" },
      { ...base, row: 4, clientName: "Nadie", serviceName: "Corte", barberName: "Pedro" },
      { ...base, row: 5, clientName: "Laura Gómez", serviceName: "Cejas", barberName: "Pedro" },
      { ...base, row: 6, clientName: "Laura Gómez", serviceName: "Corte", barberName: "Pepe" },
    ];
    const out = buildImportRows(clients, appts, {
      barbers: [{ id: "p", name: "Pedro" }],
      services: [{ id: "c", name: "Corte" }],
      barberChoice: { Pepe: "p" },
      serviceChoice: {},
    });
    expect(out.appointments).toEqual([
      {
        index: 0,
        source: appts[0],
        payload: {
          ref: null,
          phone: "+573001112233",
          name: "Laura Gómez",
          barberId: "p",
          serviceId: "c",
          startsAt: "2026-11-19T10:00:00-05:00",
          durationMin: 30,
        },
      },
      {
        index: 1,
        source: appts[4],
        payload: expect.objectContaining({ barberId: "p", phone: "+573001112233" }),
      },
    ]);
    expect(out.notImported).toEqual([
      { source: appts[1], reason: "NO_PHONE" },
      { source: appts[2], reason: "NO_PHONE" },
      { source: appts[3], reason: "UNMAPPED" },
    ]);
  });

  it("REQ-100.7 los nombres sin pareja se listan una sola vez", () => {
    const base = {
      ref: null,
      phone: "+573001112233",
      durationMin: 30,
      startsAt: "x",
      row: 2,
      clientName: "A",
    };
    const out = buildImportRows(
      [],
      [
        { ...base, serviceName: "Cejas", barberName: "Pepe" },
        { ...base, serviceName: "cejas", barberName: "Pepe" },
      ],
      { barbers: [], services: [], barberChoice: {}, serviceChoice: {} },
    );
    expect(out.unmatchedBarbers).toEqual(["Pepe"]);
    expect(out.unmatchedServices).toEqual(["Cejas"]);
  });
});
