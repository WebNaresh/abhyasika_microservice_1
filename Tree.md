├── .env
├── .env.local
├── .eslintrc.js
├── .gitignore
├── .prettierrc
├── env.d.ts
├── nest-cli.json
├── package.json
├── prisma
│   └── schema.prisma
├── README.md
├── src
│   ├── .vercel
│   │   └── cache
│   ├── app.controller.spec.ts
│   ├── app.controller.ts
│   ├── app.module.ts
│   ├── app.service.ts
│   ├── auth
│   │   ├── auth.controller.spec.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.module.ts
│   │   ├── auth.service.ts
│   │   ├── dto
│   │   │   ├── create-auth.dto.ts
│   │   │   └── update-auth.dto.ts
│   │   └── entities
│   │       └── auth.entity.ts
│   ├── common
│   │   └── filters
│   │       └── prisma-client-exception.filter.ts
│   ├── dashboard
│   │   ├── dashboard.controller.ts
│   │   ├── dashboard.module.ts
│   │   ├── dashboard.service.ts
│   │   ├── dto
│   │   │   ├── create-dashboard.dto.ts
│   │   │   └── update-dashboard.dto.ts
│   │   ├── entities
│   │   │   └── dashboard.entity.ts
│   │   └── library
│   │       ├── dto
│   │       │   ├── create-library.dto.ts
│   │       │   └── update-library.dto.ts
│   │       ├── entities
│   │       │   └── library.entity.ts
│   │       ├── library.controller.ts
│   │       ├── library.module.ts
│   │       └── library.service.ts
│   ├── domain
│   │   ├── domain.controller.ts
│   │   ├── domain.module.ts
│   │   ├── domain.service.ts
│   │   ├── dto
│   │   │   ├── create-domain.dto.ts
│   │   │   └── update-domain.dto.ts
│   │   └── entities
│   │       └── domain.entity.ts
│   ├── future_work
│   │   ├── dto
│   │   │   ├── create-future_work.dto.ts
│   │   │   └── update-future_work.dto.ts
│   │   ├── entities
│   │   │   └── future_work.entity.ts
│   │   ├── future_work.controller.ts
│   │   ├── future_work.module.ts
│   │   └── future_work.service.ts
│   ├── library
│   │   ├── branch
│   │   │   ├── branch.controller.ts
│   │   │   ├── branch.module.ts
│   │   │   ├── branch.service.ts
│   │   │   ├── dto
│   │   │   │   ├── create-branch.dto.ts
│   │   │   │   └── update-branch.dto.ts
│   │   │   ├── entities
│   │   │   │   └── branch.entity.ts
│   │   │   └── room
│   │   │       ├── desk
│   │   │       │   ├── desk.controller.ts
│   │   │       │   ├── desk.module.ts
│   │   │       │   ├── desk.service.ts
│   │   │       │   ├── dto
│   │   │       │   │   ├── create-desk.dto.ts
│   │   │       │   │   └── update-desk.dto.ts
│   │   │       │   └── entities
│   │   │       │       └── desk.entity.ts
│   │   │       ├── dto
│   │   │       │   ├── create-room.dto.ts
│   │   │       │   └── update-room.dto.ts
│   │   │       ├── entities
│   │   │       │   └── room.entity.ts
│   │   │       ├── room.controller.ts
│   │   │       ├── room.module.ts
│   │   │       └── room.service.ts
│   │   ├── dto
│   │   │   ├── create-library.dto.ts
│   │   │   └── update-library.dto.ts
│   │   ├── entities
│   │   │   └── library.entity.ts
│   │   ├── library.controller.ts
│   │   ├── library.module.ts
│   │   ├── library.service.ts
│   │   └── plans
│   │       ├── dto
│   │       │   ├── create-plan.dto.ts
│   │       │   └── update-plan.dto.ts
│   │       ├── entities
│   │       │   └── plan.entity.ts
│   │       ├── plans.controller.ts
│   │       ├── plans.module.ts
│   │       └── plans.service.ts
│   ├── main.ts
│   ├── middleware
│   │   └── role
│   │       ├── role.module.ts
│   │       ├── roles.decorator.ts
│   │       └── roles.guard.ts
│   ├── room
│   │   ├── dto
│   │   │   ├── create-room.dto.ts
│   │   │   └── update-room.dto.ts
│   │   ├── entities
│   │   │   └── room.entity.ts
│   │   ├── room.controller.ts
│   │   ├── room.module.ts
│   │   └── room.service.ts
│   ├── users
│   │   ├── admin
│   │   │   ├── admin.controller.spec.ts
│   │   │   ├── admin.controller.ts
│   │   │   ├── admin.middleware.ts
│   │   │   ├── admin.module.ts
│   │   │   ├── admin.service.spec.ts
│   │   │   ├── admin.service.ts
│   │   │   ├── dto
│   │   │   │   ├── create-admin.dto.ts
│   │   │   │   └── update-admin.dto.ts
│   │   │   └── entities
│   │   │       └── admin.entity.ts
│   │   ├── avatar
│   │   │   ├── avatar.module.ts
│   │   │   ├── avatar.service.ts
│   │   │   ├── dto
│   │   │   │   ├── create-avatar.dto.ts
│   │   │   │   └── update-avatar.dto.ts
│   │   │   └── entities
│   │   │       └── avatar.entity.ts
│   │   ├── dto
│   │   │   ├── create-users.dto.ts
│   │   │   └── update-users.dto.ts
│   │   ├── students
│   │   │   ├── dto
│   │   │   │   ├── create-student.dto.ts
│   │   │   │   └── update-student.dto.ts
│   │   │   ├── entities
│   │   │   │   └── student.entity.ts
│   │   │   ├── students.controller.ts
│   │   │   ├── students.module.ts
│   │   │   └── students.service.ts
│   │   ├── super_admin
│   │   │   ├── custom.d.ts
│   │   │   ├── dto
│   │   │   │   └── create-super_admin.dto.ts
│   │   │   ├── entities
│   │   │   │   └── super_admin.entity.ts
│   │   │   ├── super_admin.controller.spec.ts
│   │   │   ├── super_admin.controller.ts
│   │   │   ├── super_admin.middleware.ts
│   │   │   ├── super_admin.module.ts
│   │   │   ├── super_admin.service.spec.ts
│   │   │   └── super_admin.service.ts
│   │   ├── users.controller.spec.ts
│   │   ├── users.controller.ts
│   │   ├── users.middleware.ts
│   │   ├── users.module.ts
│   │   ├── users.service.spec.ts
│   │   └── users.service.ts
│   └── utils
│       ├── database
│       │   ├── database.module.ts
│       │   └── database.service.ts
│       ├── email
│       │   ├── email.module.ts
│       │   └── email.service.ts
│       ├── fast_2_sms
│       │   ├── dto
│       │   │   ├── create-fast_2_sm.dto.ts
│       │   │   └── update-fast_2_sm.dto.ts
│       │   ├── entities
│       │   │   └── fast_2_sm.entity.ts
│       │   ├── fast_2_sms.module.ts
│       │   └── fast_2_sms.service.ts
│       ├── jwt_token
│       │   ├── jwt_token.module.ts
│       │   └── jwt_token.service.ts
│       ├── puppeteer
│       │   ├── puppeteer.module.ts
│       │   └── puppeteer.service.ts
│       ├── s3
│       │   ├── dto
│       │   │   ├── create-s3.dto.ts
│       │   │   └── update-s3.dto.ts
│       │   ├── entities
│       │   │   └── s3.entity.ts
│       │   ├── s3.module.ts
│       │   └── s3.service.ts
│       └── whatsapp
│           ├── dto
│           │   ├── create-whatsapp.dto.ts
│           │   └── update-whatsapp.dto.ts
│           ├── entities
│           │   └── whatsapp.entity.ts
│           ├── whatsapp.module.ts
│           └── whatsapp.service.ts
├── test
│   ├── app.e2e-spec.ts
│   └── jest-e2e.json
├── Tree.md
├── tsconfig.build.json
├── tsconfig.json
├── vercel.json
└── yarn.lock
