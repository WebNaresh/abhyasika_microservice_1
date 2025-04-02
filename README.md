### Project Documentation

#### 1. Introduction

Welcome to the **Abhyasika API** project! This documentation will guide you through setting up and running the project, as well as provide an overview of the technologies and languages used.

#### 2. Project Overview

**Abhyasika API** is a backend application built using **NestJS**, a progressive Node.js framework for building efficient and scalable server-side applications. The project utilizes **Prisma** as the ORM for database interactions and incorporates several other technologies to ensure a robust and efficient API.

#### 3. Technology Stack

- **NestJS**: A framework for building scalable server-side applications with Node.js. It uses TypeScript and is heavily inspired by Angular.
- **Prisma**: An ORM that simplifies database access and management.
- **TypeScript**: A superset of JavaScript that adds static types, improving development and code quality.
- **Axios**: A promise-based HTTP client for making requests.
- **Puppeteer**: A Node library for controlling headless Chrome.
- **JWT**: JSON Web Tokens for secure user authentication.
- **AWS SDK**: For interacting with Amazon Web Services, including S3 for file storage.
- **Prettier & ESLint**: For code formatting and linting.

#### 4. Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/) (version 18 or higher recommended)
- [Yarn](https://classic.yarnpkg.com/) (or npm if you prefer)

#### 5. Setup and Installation

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. **Install dependencies:**

   ```bash
   yarn install
   ```

3. **Set up environment variables:**

   - Create a `.env` file in the root directory based on the `.env.example` file.
   - For specific environment variable configurations, visit [Abhyasika Project Configuration](https://www.notion.so/Abhyasika-Project-Configuration-45cfb48e265a411598b12bccca6f5f21).
   - Example `.env` configuration:

     ```plaintext
     DATABASE_URL="postgresql://user:password@localhost:5432/mydatabase"
     JWT_SECRET="your_jwt_secret"
     AWS_ACCESS_KEY_ID="your_aws_access_key_id"
     AWS_SECRET_ACCESS_KEY="your_aws_secret_access_key"
     S3_BUCKET="your_s3_bucket_name"
     ```

4. **Database Setup:**

   - Install [Prisma CLI](https://www.prisma.io/docs/concepts/components/prisma-cli) globally if you haven't already:

     ```bash
     yarn global add prisma
     ```

   - Run the Prisma migration to set up your database:

     ```bash
     yarn prisma:migrate
     ```

   - Generate the Prisma client:

     ```bash
     yarn prisma:generate
     ```

5. **Running the Application:**

   - For development:

     ```bash
     yarn dev
     ```

   - For production:

     ```bash
     yarn start:prod
     ```

   - To build the project:

     ```bash
     yarn build
     ```

6. **Running Tests:**

   - To run all tests:

     ```bash
     yarn test
     ```

   - To run end-to-end tests:

     ```bash
     yarn test:e2e
     ```

#### 6. Project Structure

- **src/**: Contains the source code for the project.
  - **auth/**: Authentication-related modules and services.
  - **dashboard/**: Dashboard-related modules and services.
  - **domain/**: Domain-related modules and services.
  - **library/**: Library-related modules, including branches, rooms, and plans.
  - **middleware/**: Custom middleware for role-based access control.
  - **room/**: Room-related modules and services.
  - **users/**: User-related modules, including admin, students, avatars, and super_admin.
  - **utils/**: Utility modules for database, email, JWT, S3, and more.
- **test/**: Contains test files and configurations.
- **prisma/**: Contains Prisma schema and configuration files.
- **README.md**: This documentation file.

#### 7. Coding Guidelines

- **Code Style**: Follow the rules set by ESLint and Prettier for code formatting and linting.
- **Commit Messages**: Write clear and concise commit messages following the conventional commits convention.

#### 8. Contributing

If you would like to contribute to this project:

1. Fork the repository.
2. Create a new branch for your changes.
3. Make your changes and test thoroughly.
4. Submit a pull request with a detailed description of your changes.

#### 9. Troubleshooting

- **Common Issues**: Check the issues section of the repository for known problems and solutions.
- **Contact**: If you encounter any issues not covered in this documentation, feel free to reach out to the maintainers via the repository's communication channels.

#### 10. Additional Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Prettier Documentation](https://prettier.io/docs/en/)

#### 11. Help

For additional help, please contact **WebNaresh**.

Feel free to explore and modify the project as needed. Happy coding!
