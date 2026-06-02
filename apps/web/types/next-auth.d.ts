import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    practitionerId: string;
    projectId: string;
    role: string;
    createdAt: string;
    subscriptionStatus: string;
    subscriptionPlan: string;
  }

  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      practitionerId: string;
      projectId: string;
      role: string;
      createdAt: string;
      subscriptionStatus: string;
      subscriptionPlan: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    practitionerId: string;
    projectId: string;
    role?: string;
    createdAt?: string;
    subscriptionStatus?: string;
    subscriptionPlan?: string;
  }
}
