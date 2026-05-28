import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q');

  // TODO: verify session + resolve projectId
  // TODO: search Patient resources in Medplum
  // TODO: map via fromFHIRPatient

  return NextResponse.json({ patients: [], q });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // TODO: verify session
  // TODO: validate body (required: name, phone)
  // TODO: validate CPF if present via isValidCPF
  // TODO: create Patient in Medplum via toFHIRPatient

  return NextResponse.json({ id: 'pending' }, { status: 201 });
}
