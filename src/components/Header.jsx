import { Button, Flex, Image } from 'antd'
import React from 'react'
import useAuth from '../stores/useAuth'
import logo from '../img/logo.svg'

export default function Header() {
    const { authing, isAuth, exit } = useAuth(store => store)
    return (
        <Flex justify='space-between' align='center' style={{ padding: 20, backgroundColor: "#0061aa" }}>
            <Image src={logo} preview={false}/>
            {isAuth &&
                <Button>Выход</Button>
            }
        </Flex>
    )
}
