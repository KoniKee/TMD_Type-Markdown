import React from 'react';
import { Layout } from './components/Layout';
import { useTheme } from './hooks';

function App() {
  // 初始化主题
  useTheme();
  
  return <Layout />;
}

export default App;