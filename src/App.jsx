import { Button, Typography } from 'antd'
import { useEffect, useState } from 'react'
import Container from './components/Container'
import useAuth from './stores/useAuth'
import Header from './components/Header'
import AuthForm from './components/AuthForm'
import TableTN from './components/main/TableTN'

function App() {
  const { authing, isAuth, exit, getJwt, fieldsSetting, getFieldsSetting } = useAuth(store => store)
  useEffect(() => {
    getJwt()
    getFieldsSetting()
  }, [])
  useEffect(() => {
    getFieldsSetting()
  }, [isAuth])


  return (
    <>
      <Header />
      <Container>
        {!isAuth && <AuthForm />}

        {isAuth &&
          <TableTN />
        }
      </Container>
    </>
  )
}

export default App
