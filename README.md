# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

This project is related to a LLM chat app I want to build using react native expo app for iOS, android, and web. By leveraging the AI SDK by Vercel, I want to create a unified way to access various LLM models (like ChatGPT from OpenAI or Gemini by Google). A user should be able to select from a list of different models to use for different chats. Also, they should be able to enter their own api-key in order to access those services (and thus pay for those services themselves based on usage). These api-keys will be stored on device. Some of the libraries it will use include: expo-sqlite for storing the chats locally, zeego from dropdown menus (like when selecting which model to use), react-native-mmkv for storing the api-keys, shopify/flash-list for displaying the chats on the screen, expo-clipboard for copy text to a clipboard, react-native-keyboard-controller for managing the onscreen keyboard. 